import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUserId, unauthorized, badRequest, serverError } from "@/lib/api-helpers";
import { continueFromScript, continueFromAudio, regenerateScript, regenerateAudio } from "@/lib/services/pipeline";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorized();

    const body = await req.json();
    const { action, editedScript } = body as {
      action: "approve" | "regenerate";
      editedScript?: string;
    };

    if (!action || !["approve", "regenerate"].includes(action)) {
      return badRequest("Action must be 'approve' or 'regenerate'");
    }

    const video = await prisma.video.findFirst({
      where: { id: params.id, userId },
    });

    if (!video) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (video.status === "SCRIPT_READY") {
      if (action === "regenerate") {
        regenerateScript(video.id).catch(console.error);
        return NextResponse.json({ success: true, status: "GENERATING_SCRIPT" });
      }

      // Approve — optionally save edited script
      if (editedScript && editedScript.trim()) {
        await prisma.video.update({
          where: { id: video.id },
          data: { script: editedScript.trim() },
        });
      }

      continueFromScript(video.id).catch(console.error);
      return NextResponse.json({ success: true, status: "GENERATING_AUDIO" });
    }

    if (video.status === "AUDIO_READY") {
      if (action === "regenerate") {
        regenerateAudio(video.id).catch(console.error);
        return NextResponse.json({ success: true, status: "GENERATING_AUDIO" });
      }

      continueFromAudio(video.id).catch(console.error);
      return NextResponse.json({ success: true, status: "GENERATING_VIDEO" });
    }

    return badRequest(`Cannot approve video in status: ${video.status}`);
  } catch (error) {
    return serverError(error);
  }
}
