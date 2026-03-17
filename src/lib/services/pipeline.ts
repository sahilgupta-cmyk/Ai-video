import { prisma } from "@/lib/db";
import { generateScript } from "./script-generator";
import { generateSpeech, uploadAudioForHeyGen } from "./tts-service";
import { createAvatarVideo } from "./avatar-service";
import { getTargetWords } from "@/lib/constants";

interface UserWithKeys {
  id: string;
  claudeApiKey: string | null;
  openaiApiKey: string | null;
  aiProvider: string;
  elevenLabsApiKey: string | null;
  heygenApiKey: string | null;
  heygenAvatarId: string | null;
  elevenLabsVoiceId: string | null;
}

function getAvailableSteps(user: UserWithKeys) {
  const provider = user.aiProvider || "claude";
  const hasScript = (provider === "openai" && !!user.openaiApiKey) ||
                    (provider === "claude" && !!user.claudeApiKey) ||
                    (!!user.claudeApiKey || !!user.openaiApiKey); // fallback: any key works
  return {
    hasScript,
    hasAudio: !!user.elevenLabsApiKey && !!user.elevenLabsVoiceId,
    hasVideo: !!user.heygenApiKey && !!user.heygenAvatarId,
  };
}

function getScriptApiKey(user: UserWithKeys): { apiKey: string; provider: "claude" | "openai" } {
  const provider = user.aiProvider || "claude";
  if (provider === "openai" && user.openaiApiKey) {
    return { apiKey: user.openaiApiKey, provider: "openai" };
  }
  if (provider === "claude" && user.claudeApiKey) {
    return { apiKey: user.claudeApiKey, provider: "claude" };
  }
  // Fallback: use whichever key is available
  if (user.claudeApiKey) return { apiKey: user.claudeApiKey, provider: "claude" };
  if (user.openaiApiKey) return { apiKey: user.openaiApiKey, provider: "openai" };
  throw new Error("No AI API key configured. Please add a Claude or OpenAI key in Settings.");
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
  try {
  const video = await fetchVideoWithUser(videoId);
  const user = video.user;
  const { hasScript } = getAvailableSteps(user);

  if (!hasScript) {
    await failVideo(videoId, "No AI API key configured. Please add a Claude or OpenAI key in Settings.");
    return;
  }
    // Step 1: Generate script
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "GENERATING_SCRIPT" },
    });

    const { apiKey: scriptApiKey, provider } = getScriptApiKey(user);
    const targetWords = getTargetWords(video.contentFormat, video.targetDuration);
    const { script, voiceStyle } = await generateScript({
      topic: video.topic,
      userId: user.id,
      apiKey: scriptApiKey,
      provider,
      contentFormat: video.contentFormat,
      targetDuration: video.targetDuration,
      targetWords,
    });

    await prisma.video.update({
      where: { id: videoId },
      data: { script, voiceStyle, status: "SCRIPT_READY" },
    });

    // Always pause here so the user can review the script.
    // User clicks "Next" / "Approve" to continue to audio.
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
  try {
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
    // Step 2: Generate audio
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "GENERATING_AUDIO" },
    });

    const { audioData } = await generateSpeech({
      text: video.script!,
      voiceId: user.elevenLabsVoiceId!,
      apiKey: user.elevenLabsApiKey!,
      voiceInstructions: video.voiceStyle || undefined,
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
  try {
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
    // Step 3: Create avatar video
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "GENERATING_VIDEO" },
    });

    const heygenVideoId = await createAvatarVideo({
      avatarId: user.heygenAvatarId!,
      audioAssetId: video.audioUrl!,
      apiKey: user.heygenApiKey!,
      videoFormat: (video.videoFormat as "landscape" | "portrait" | "square") || undefined,
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
  try {
  const video = await fetchVideoWithUser(videoId);
  const user = video.user;
    const { apiKey: scriptApiKey, provider } = getScriptApiKey(user);

    await prisma.video.update({
      where: { id: videoId },
      data: { status: "GENERATING_SCRIPT" },
    });

    const targetWords = getTargetWords(video.contentFormat, video.targetDuration);
    const { script, voiceStyle } = await generateScript({
      topic: video.topic,
      userId: user.id,
      apiKey: scriptApiKey,
      provider,
      contentFormat: video.contentFormat,
      targetDuration: video.targetDuration,
      targetWords,
    });

    await prisma.video.update({
      where: { id: videoId },
      data: { script, voiceStyle, status: "SCRIPT_READY" },
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
  try {
  const video = await fetchVideoWithUser(videoId);
  const user = video.user;

  if (!user.elevenLabsApiKey || !user.elevenLabsVoiceId) {
    await failVideo(videoId, "No ElevenLabs API key or voice ID configured.");
    return;
  }
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "GENERATING_AUDIO" },
    });

    const { audioData } = await generateSpeech({
      text: video.script!,
      voiceId: user.elevenLabsVoiceId,
      apiKey: user.elevenLabsApiKey,
      voiceInstructions: video.voiceStyle || undefined,
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
