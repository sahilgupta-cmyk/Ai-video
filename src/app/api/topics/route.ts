import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUserId, unauthorized, badRequest, serverError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorized();

    const topics = await prisma.topic.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(topics);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorized();

    const body = await req.json();
    const { titles, category } = body as { titles: string[]; category?: string };

    if (!titles || !Array.isArray(titles) || titles.length === 0) {
      return badRequest("At least one topic title is required");
    }

    const topics = await Promise.all(
      titles
        .filter((t) => t.trim())
        .map((title) =>
          prisma.topic.create({
            data: {
              userId,
              title: title.trim(),
              ...(category && { category: category.trim() }),
            },
          })
        )
    );

    return NextResponse.json(topics, { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
