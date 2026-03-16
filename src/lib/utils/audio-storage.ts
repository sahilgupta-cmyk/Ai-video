import * as fs from "fs";
import * as path from "path";

const AUDIO_DIR = path.join(process.cwd(), "uploads", "audio");

export function saveAudioFile(videoId: string, audioData: Buffer): string {
  // Ensure directory exists
  fs.mkdirSync(AUDIO_DIR, { recursive: true });

  const filePath = path.join(AUDIO_DIR, `${videoId}.mp3`);
  fs.writeFileSync(filePath, audioData);

  // Return the API URL for streaming
  return `/api/audio/${videoId}`;
}

export function deleteAudioFile(videoId: string): void {
  const filePath = path.join(AUDIO_DIR, `${videoId}.mp3`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
