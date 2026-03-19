import { decrypt } from "@/lib/utils/encryption";

interface TTSOptions {
  text: string;
  voiceId: string;
  apiKey: string;
  voiceInstructions?: string;
}

interface TTSResult {
  audioUrl: string;
  audioData: Buffer;
}

function getVoiceSettings(voiceStyle?: string): Record<string, number | boolean> {
  switch (voiceStyle) {
    case "energetic":
      return { stability: 0.3, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true };
    case "calm":
      return { stability: 0.65, similarity_boost: 0.7, style: 0.2, use_speaker_boost: true };
    case "dramatic":
      return { stability: 0.25, similarity_boost: 0.85, style: 0.9, use_speaker_boost: true };
    case "conversational":
      return { stability: 0.5, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true };
    default:
      return { stability: 0.5, similarity_boost: 0.75 };
  }
}

export async function generateSpeech({ text, voiceId, apiKey, voiceInstructions }: TTSOptions): Promise<TTSResult> {
  const decryptedKey = decrypt(apiKey);

  // Map voice style preset to ElevenLabs voice_settings parameters
  // Do NOT prepend voice instructions as text — ElevenLabs reads them aloud
  const voiceSettings = getVoiceSettings(voiceInstructions);

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
        model_id: "eleven_multilingual_v2",
        voice_settings: voiceSettings,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());

  return {
    audioUrl: "",
    audioData: audioBuffer,
  };
}

export async function uploadAudioForHeyGen(
  audioData: Buffer,
  heygenApiKey: string
): Promise<string> {
  const decryptedKey = decrypt(heygenApiKey);

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
