import { prisma } from "@/lib/db";

/**
 * Save audio data to the database as base64 and return the API URL for streaming.
 */
export async function saveAudioToDb(videoId: string, audioData: Buffer): Promise<string> {
  const base64Audio = audioData.toString("base64");

  await prisma.video.update({
    where: { id: videoId },
    data: { audioData: base64Audio },
  });

  return `/api/audio/${videoId}`;
}
