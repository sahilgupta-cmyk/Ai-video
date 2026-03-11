import { decrypt } from "@/lib/utils/encryption";

interface CreateVideoOptions {
  avatarId: string;
  audioAssetId: string;
  apiKey: string;
}

interface VideoStatus {
  status: "processing" | "completed" | "failed";
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  error?: string;
}

export async function createAvatarVideo({
  avatarId,
  audioAssetId,
  apiKey,
}: CreateVideoOptions): Promise<string> {
  const decryptedKey = decrypt(apiKey);

  const response = await fetch("https://api.heygen.com/v2/video/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": decryptedKey,
    },
    body: JSON.stringify({
      video_inputs: [
        {
          character: {
            type: "avatar",
            avatar_id: avatarId,
            avatar_style: "normal",
          },
          voice: {
            type: "audio",
            audio_asset_id: audioAssetId,
          },
        },
      ],
      dimension: {
        width: 1920,
        height: 1080,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HeyGen create video error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.data.video_id;
}

export async function checkVideoStatus(
  videoId: string,
  apiKey: string
): Promise<VideoStatus> {
  const decryptedKey = decrypt(apiKey);

  const response = await fetch(
    `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
    {
      headers: {
        "X-Api-Key": decryptedKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HeyGen status check error: ${response.status}`);
  }

  const data = await response.json();
  const videoData = data.data;

  if (videoData.status === "completed") {
    return {
      status: "completed",
      videoUrl: videoData.video_url,
      thumbnailUrl: videoData.thumbnail_url,
      duration: videoData.duration,
    };
  }

  if (videoData.status === "failed") {
    return {
      status: "failed",
      error: videoData.error || "Video generation failed",
    };
  }

  return { status: "processing" };
}
