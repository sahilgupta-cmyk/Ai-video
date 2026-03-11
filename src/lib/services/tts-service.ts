import { decrypt } from "@/lib/utils/encryption";

interface TTSOptions {
  text: string;
  voiceId: string;
  apiKey: string;
}

interface TTSResult {
  audioUrl: string;
  audioData: Buffer;
}

export async function generateSpeech({ text, voiceId, apiKey }: TTSOptions): Promise<TTSResult> {
  const decryptedKey = decrypt(apiKey);

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": decryptedKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());

  // For ElevenLabs, the audio is returned directly as a binary stream
  // We'll need to upload it or convert to a URL for HeyGen
  // For now, we return the buffer - the pipeline will handle upload
  return {
    audioUrl: "", // Will be set after upload
    audioData: audioBuffer,
  };
}

export async function uploadAudioForHeyGen(
  audioData: Buffer,
  heygenApiKey: string
): Promise<string> {
  const decryptedKey = decrypt(heygenApiKey);

  // Upload audio to HeyGen
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(audioData)], { type: "audio/mpeg" });
  formData.append("file", blob, "speech.mp3");

  const response = await fetch("https://api.heygen.com/v1/asset", {
    method: "POST",
    headers: {
      "X-Api-Key": decryptedKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HeyGen upload error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.data.asset_id || data.data.url;
}
