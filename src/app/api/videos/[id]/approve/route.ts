import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUserId, unauthorized, badRequest, serverError } from "@/lib/api-helpers";
import { generateScript } from "@/lib/services/script-generator";
import { generateSpeech, uploadAudioForHeyGen } from "@/lib/services/tts-service";
import { createAvatarVideo } from "@/lib/services/avatar-service";
import { saveAudioToDb } from "@/lib/utils/audio-storage";


export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorized();

    const body = await req.json();
    const { action, editedScript, voiceInstructions } = body as {
      action: "approve" | "regenerate";
      editedScript?: string;
      voiceInstructions?: string;
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        claudeApiKey: true,
        openaiApiKey: true,
        aiProvider: true,
        elevenLabsApiKey: true,
        elevenLabsVoiceId: true,
        heygenApiKey: true,
        heygenAvatarId: true,
      },
    });

    if (!user) {
      return badRequest("User not found");
    }

    if (video.status === "SCRIPT_READY") {
      if (action === "regenerate") {
        // Regenerate script synchronously
        const provider = (user.aiProvider || "claude") as "claude" | "openai";
        let apiKey: string | null = null;
        let selectedProvider: "claude" | "openai" = provider;

        if (provider === "openai" && user.openaiApiKey) {
          apiKey = user.openaiApiKey;
        } else if (provider === "claude" && user.claudeApiKey) {
          apiKey = user.claudeApiKey;
        } else if (user.claudeApiKey) {
          apiKey = user.claudeApiKey;
          selectedProvider = "claude";
        } else if (user.openaiApiKey) {
          apiKey = user.openaiApiKey;
          selectedProvider = "openai";
        }

        if (!apiKey) {
          return badRequest("No AI API key configured");
        }

        await prisma.video.update({
          where: { id: video.id },
          data: { status: "GENERATING_SCRIPT" },
        });

        try {
          const script = await generateScript({
            topic: video.topic,
            userId,
            apiKey,
            provider: selectedProvider,
          });

          const updated = await prisma.video.update({
            where: { id: video.id },
            data: { script, status: "SCRIPT_READY" },
          });

          return NextResponse.json({ success: true, video: updated });
        } catch (genError) {
          const errorMessage = genError instanceof Error ? genError.message : "Script generation failed";
          await prisma.video.update({
            where: { id: video.id },
            data: { status: "FAILED", errorMessage },
          });
          return NextResponse.json({ error: errorMessage }, { status: 500 });
        }
      }

      // Approve — optionally save edited script
      if (editedScript && editedScript.trim()) {
        await prisma.video.update({
          where: { id: video.id },
          data: { script: editedScript.trim() },
        });
      }

      const scriptText = editedScript?.trim() || video.script;

      // Check if audio is available
      if (!user.elevenLabsApiKey || !user.elevenLabsVoiceId) {
        const updated = await prisma.video.update({
          where: { id: video.id },
          data: { status: "COMPLETED" },
        });
        return NextResponse.json({ success: true, video: updated });
      }

      // Generate audio synchronously
      await prisma.video.update({
        where: { id: video.id },
        data: { status: "GENERATING_AUDIO" },
      });

      try {
        const { audioData } = await generateSpeech({
          text: scriptText!,
          voiceId: user.elevenLabsVoiceId,
          apiKey: user.elevenLabsApiKey,
          voiceInstructions,
        });

        // Save audio file to disk for playback
        const audioUrl = await saveAudioToDb(video.id, audioData);

        const hasVideo = !!user.heygenApiKey && !!user.heygenAvatarId;
        if (hasVideo) {
          await uploadAudioForHeyGen(audioData, user.heygenApiKey!);
        }

        const updated = await prisma.video.update({
          where: { id: video.id },
          data: { audioUrl, status: "AUDIO_READY" },
        });

        return NextResponse.json({ success: true, video: updated });
      } catch (audioError) {
        const errorMessage = audioError instanceof Error ? audioError.message : "Audio generation failed";
        await prisma.video.update({
          where: { id: video.id },
          data: { status: "FAILED", errorMessage },
        });
        return NextResponse.json({ error: errorMessage }, { status: 500 });
      }
    }

    if (video.status === "AUDIO_READY") {
      if (action === "regenerate") {
        if (!user.elevenLabsApiKey || !user.elevenLabsVoiceId) {
          return badRequest("No ElevenLabs API key or voice ID configured");
        }

        await prisma.video.update({
          where: { id: video.id },
          data: { status: "GENERATING_AUDIO" },
        });

        try {
          const { audioData } = await generateSpeech({
            text: video.script!,
            voiceId: user.elevenLabsVoiceId,
            apiKey: user.elevenLabsApiKey,
          });

          // Save audio file to disk for playback
          const audioUrl = await saveAudioToDb(video.id, audioData);

          const hasVideoApi = !!user.heygenApiKey && !!user.heygenAvatarId;
          if (hasVideoApi) {
            await uploadAudioForHeyGen(audioData, user.heygenApiKey!);
          }

          const updated = await prisma.video.update({
            where: { id: video.id },
            data: { audioUrl, status: "AUDIO_READY" },
          });

          return NextResponse.json({ success: true, video: updated });
        } catch (audioError) {
          const errorMessage = audioError instanceof Error ? audioError.message : "Audio generation failed";
          await prisma.video.update({
            where: { id: video.id },
            data: { status: "FAILED", errorMessage },
          });
          return NextResponse.json({ error: errorMessage }, { status: 500 });
        }
      }

      // Approve audio — move to video generation
      if (!user.heygenApiKey || !user.heygenAvatarId) {
        const updated = await prisma.video.update({
          where: { id: video.id },
          data: { status: "COMPLETED" },
        });
        return NextResponse.json({ success: true, video: updated });
      }

      await prisma.video.update({
        where: { id: video.id },
        data: { status: "GENERATING_VIDEO" },
      });

      try {
        const heygenVideoId = await createAvatarVideo({
          avatarId: user.heygenAvatarId,
          audioAssetId: video.audioUrl!,
          apiKey: user.heygenApiKey,
        });

        const updated = await prisma.video.update({
          where: { id: video.id },
          data: { heygenVideoId },
        });

        return NextResponse.json({ success: true, video: updated });
      } catch (videoError) {
        const errorMessage = videoError instanceof Error ? videoError.message : "Video generation failed";
        await prisma.video.update({
          where: { id: video.id },
          data: { status: "FAILED", errorMessage },
        });
        return NextResponse.json({ error: errorMessage }, { status: 500 });
      }
    }

    return badRequest(`Cannot approve video in status: ${video.status}`);
  } catch (error) {
    return serverError(error);
  }
}
