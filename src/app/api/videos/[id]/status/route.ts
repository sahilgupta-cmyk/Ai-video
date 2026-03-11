import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUserId, unauthorized, serverError } from "@/lib/api-helpers";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorized();

    const video = await prisma.video.findFirst({
      where: { id: params.id, userId },
      select: {
        id: true,
        status: true,
        videoUrl: true,
        thumbnailUrl: true,
        duration: true,
        errorMessage: true,
      },
    });

    if (!video) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(video);
  } catch (error) {
    return serverError(error);
  }
}
