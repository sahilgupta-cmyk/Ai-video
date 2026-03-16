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

export async function generateSpeech({ text, voiceId, apiKey, voiceInstructions }: TTSOptions): Promise<TTSResult> {
  const decryptedKey = decrypt(apiKey);

  // If voice instructions provided, prepend them as SSML-style direction
  // ElevenLabs doesn't support SSML but we can prepend instructions in the text
  let speechText = text;
  if (voiceInstructions && voiceInstructions.trim()) {
    // Add voice direction as a preamble that ElevenLabs will interpret naturally
    speechText = `[Voice direction: ${voiceInstructions.trim()}]\n\n${text}`;
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": decryptedKey,
      },
      body: JSON.stringify({
        text: speechText,
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
