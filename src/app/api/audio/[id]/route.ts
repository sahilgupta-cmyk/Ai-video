import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUserId, unauthorized, serverError } from "@/lib/api-helpers";
import * as fs from "fs";
import * as path from "path";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorized();

    const video = await prisma.video.findFirst({
      where: { id: params.id, userId },
      select: { id: true, audioUrl: true },
    });

    if (!video || !video.audioUrl) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Audio is stored as a file path like /audio/<videoId>.mp3
    const audioPath = path.join(process.cwd(), "uploads", "audio", `${video.id}.mp3`);

    if (!fs.existsSync(audioPath)) {
      return NextResponse.json({ error: "Audio file not found" }, { status: 404 });
    }

    const audioBuffer = fs.readFileSync(audioPath);

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
