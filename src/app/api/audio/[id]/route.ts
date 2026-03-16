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
      select: { id: true, audioData: true },
    });

    if (!video || !video.audioData) {
      return NextResponse.json({ error: "Audio not found" }, { status: 404 });
    }

    const audioBuffer = Buffer.from(video.audioData, "base64");

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
