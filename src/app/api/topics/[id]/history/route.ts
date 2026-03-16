import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUserId, unauthorized, serverError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorized();

    // Verify topic belongs to user
    const topic = await prisma.topic.findFirst({
      where: { id: params.id, userId },
    });

    if (!topic) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Find all videos linked to this topic
    const videos = await prisma.video.findMany({
      where: { topicId: params.id, userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ topic, videos });
  } catch (error) {
    return serverError(error);
  }
}
