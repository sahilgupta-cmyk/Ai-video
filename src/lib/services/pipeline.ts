import { prisma } from "@/lib/db";
import { generateScript } from "./script-generator";
import { generateSpeech, uploadAudioForHeyGen } from "./tts-service";
import { createAvatarVideo } from "./avatar-service";

interface UserWithKeys {
  id: string;
  claudeApiKey: string | null;
  elevenLabsApiKey: string | null;
  heygenApiKey: string | null;
  heygenAvatarId: string | null;
  elevenLabsVoiceId: string | null;
}

function getAvailableSteps(user: UserWithKeys) {
  return {
    hasScript: !!user.claudeApiKey,
    hasAudio: !!user.elevenLabsApiKey && !!user.elevenLabsVoiceId,
    hasVideo: !!user.heygenApiKey && !!user.heygenAvatarId,
  };
}

async function fetchVideoWithUser(videoId: string) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: { user: true },
  });
  if (!video || !video.user) {
    throw new Error("Video or user not found");
  }
  return video;
}

async function failVideo(videoId: string, errorMessage: string) {
  await prisma.video.update({
    where: { id: videoId },
    data: { status: "FAILED", errorMessage },
  });
}

/**
 * Start the pipeline: generate script, then pause or continue based on autoApprove and available APIs.
 */
export async function runVideoPipeline(videoId: string) {
  const video = await fetchVideoWithUser(videoId);
  const user = video.user;
  const { hasScript, hasAudio, hasVideo } = getAvailableSteps(user);

  if (!hasScript) {
    await failVideo(videoId, "No Claude API key configured. Please add it in Settings.");
    return;
  }

  try {
    // Step 1: Generate script
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "GENERATING_SCRIPT" },
    });

    const script = await generateScript({
      topic: video.topic,
      userId: user.id,
      apiKey: user.claudeApiKey!,
    });

    await prisma.video.update({
      where: { id: videoId },
      data: { script },
    });

    // If no further steps available, complete now
    if (!hasAudio && !hasVideo) {
      await prisma.video.update({
        where: { id: videoId },
        data: { status: "COMPLETED" },
      });
      return;
    }

    // If not auto-approve, pause for user review
    if (!video.autoApprove) {
      await prisma.video.update({
        where: { id: videoId },
        data: { status: "SCRIPT_READY" },
      });
      return;
    }

    // Auto-approve: continue to audio
    await continueFromScript(videoId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Pipeline error for video ${videoId}:`, errorMessage);
    await failVideo(videoId, errorMessage);
  }
}

/**
 * Continue pipeline after script approval: generate audio, then pause or continue.
 */
export async function continueFromScript(videoId: string) {
  const video = await fetchVideoWithUser(videoId);
  const user = video.user;
  const { hasAudio, hasVideo } = getAvailableSteps(user);

  if (!hasAudio) {
    // No audio API — complete with script only
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "COMPLETED" },
    });
    return;
  }

  try {
    // Step 2: Generate audio
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "GENERATING_AUDIO" },
    });

    const { audioData } = await generateSpeech({
      text: video.script!,
      voiceId: user.elevenLabsVoiceId!,
      apiKey: user.elevenLabsApiKey!,
    });

    // Upload to HeyGen if we have video capability, otherwise store audio reference
    let audioAssetId = "";
    if (hasVideo) {
      audioAssetId = await uploadAudioForHeyGen(audioData, user.heygenApiKey!);
    }

    await prisma.video.update({
      where: { id: videoId },
      data: { audioUrl: audioAssetId || "audio-generated" },
    });

    // If no video step, complete now
    if (!hasVideo) {
      await prisma.video.update({
        where: { id: videoId },
        data: { status: "COMPLETED" },
      });
      return;
    }

    // If not auto-approve, pause for user review
    if (!video.autoApprove) {
      await prisma.video.update({
        where: { id: videoId },
        data: { status: "AUDIO_READY" },
      });
      return;
    }

    // Auto-approve: continue to video
    await continueFromAudio(videoId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Audio pipeline error for video ${videoId}:`, errorMessage);
    await failVideo(videoId, errorMessage);
  }
}

/**
 * Continue pipeline after audio approval: generate avatar video.
 */
export async function continueFromAudio(videoId: string) {
  const video = await fetchVideoWithUser(videoId);
  const user = video.user;
  const { hasVideo } = getAvailableSteps(user);

  if (!hasVideo) {
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "COMPLETED" },
    });
    return;
  }

  try {
    // Step 3: Create avatar video
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "GENERATING_VIDEO" },
    });

    const heygenVideoId = await createAvatarVideo({
      avatarId: user.heygenAvatarId!,
      audioAssetId: video.audioUrl!,
      apiKey: user.heygenApiKey!,
    });

    await prisma.video.update({
      where: { id: videoId },
      data: { heygenVideoId },
    });

    // Video is now processing on HeyGen's side
    // The cron job will poll for completion
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Video pipeline error for video ${videoId}:`, errorMessage);
    await failVideo(videoId, errorMessage);
  }
}

/**
 * Regenerate script for a video (re-runs script generation).
 */
export async function regenerateScript(videoId: string) {
  const video = await fetchVideoWithUser(videoId);
  const user = video.user;

  if (!user.claudeApiKey) {
    await failVideo(videoId, "No Claude API key configured.");
    return;
  }

  try {
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "GENERATING_SCRIPT" },
    });

    const script = await generateScript({
      topic: video.topic,
      userId: user.id,
      apiKey: user.claudeApiKey,
    });

    await prisma.video.update({
      where: { id: videoId },
      data: { script, status: "SCRIPT_READY" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Regenerate script error for video ${videoId}:`, errorMessage);
    await failVideo(videoId, errorMessage);
  }
}

/**
 * Regenerate audio for a video (re-runs audio generation).
 */
export async function regenerateAudio(videoId: string) {
  const video = await fetchVideoWithUser(videoId);
  const user = video.user;

  if (!user.elevenLabsApiKey || !user.elevenLabsVoiceId) {
    await failVideo(videoId, "No ElevenLabs API key or voice ID configured.");
    return;
  }

  try {
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "GENERATING_AUDIO" },
    });

    const { audioData } = await generateSpeech({
      text: video.script!,
      voiceId: user.elevenLabsVoiceId,
      apiKey: user.elevenLabsApiKey,
    });

    const hasVideo = !!user.heygenApiKey && !!user.heygenAvatarId;
    let audioAssetId = "";
    if (hasVideo) {
      audioAssetId = await uploadAudioForHeyGen(audioData, user.heygenApiKey!);
    }

    await prisma.video.update({
      where: { id: videoId },
      data: { audioUrl: audioAssetId || "audio-generated", status: "AUDIO_READY" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Regenerate audio error for video ${videoId}:`, errorMessage);
    await failVideo(videoId, errorMessage);
  }
}
