import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUserId, unauthorized, badRequest, serverError } from "@/lib/api-helpers";
import { runVideoPipeline } from "@/lib/services/pipeline";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorized();

    const videos = await prisma.video.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(videos);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorized();

    const body = await req.json();
    const { topics } = body as { topics: string[] };

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return badRequest("At least one topic is required");
    }

    const videos = await Promise.all(
      topics.map((topic) =>
        prisma.video.create({
          data: {
            userId,
            topic: topic.trim(),
            status: "PENDING",
          },
        })
      )
    );

    // Kick off the pipeline for each video (non-blocking)
    for (const video of videos) {
      runVideoPipeline(video.id).catch(console.error);
    }

    return NextResponse.json(videos, { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
