import { prisma } from "@/lib/db";
import { generateScript } from "./script-generator";
import { generateSpeech, uploadAudioForHeyGen } from "./tts-service";
import { createAvatarVideo } from "./avatar-service";

export async function runVideoPipeline(videoId: string) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: { user: true },
  });

  if (!video || !video.user) {
    throw new Error("Video or user not found");
  }

  const user = video.user;

  if (!user.claudeApiKey || !user.elevenLabsApiKey || !user.heygenApiKey) {
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "FAILED",
        errorMessage: "Missing API keys. Please configure all API keys in Settings.",
      },
    });
    return;
  }

  if (!user.heygenAvatarId || !user.elevenLabsVoiceId) {
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "FAILED",
        errorMessage: "Missing avatar or voice ID. Please configure in Settings.",
      },
    });
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
      apiKey: user.claudeApiKey,
    });

    await prisma.video.update({
      where: { id: videoId },
      data: { script },
    });

    // Step 2: Generate audio
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "GENERATING_AUDIO" },
    });

    const { audioData } = await generateSpeech({
      text: script,
      voiceId: user.elevenLabsVoiceId,
      apiKey: user.elevenLabsApiKey,
    });

    const audioAssetId = await uploadAudioForHeyGen(audioData, user.heygenApiKey);

    await prisma.video.update({
      where: { id: videoId },
      data: { audioUrl: audioAssetId },
    });

    // Step 3: Create avatar video
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "GENERATING_VIDEO" },
    });

    const heygenVideoId = await createAvatarVideo({
      avatarId: user.heygenAvatarId,
      audioAssetId,
      apiKey: user.heygenApiKey,
    });

    await prisma.video.update({
      where: { id: videoId },
      data: { heygenVideoId },
    });

    // Video is now processing on HeyGen's side
    // The cron job will poll for completion
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Pipeline error for video ${videoId}:`, errorMessage);
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "FAILED",
        errorMessage,
      },
    });
  }
}
