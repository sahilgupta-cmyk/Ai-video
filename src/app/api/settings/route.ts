import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUserId, unauthorized, serverError } from "@/lib/api-helpers";
import { encrypt, decrypt } from "@/lib/utils/encryption";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        claudeApiKey: true,
        openaiApiKey: true,
        aiProvider: true,
        elevenLabsApiKey: true,
        heygenApiKey: true,
        heygenAvatarId: true,
        elevenLabsVoiceId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      claudeApiKey: user.claudeApiKey ? `****${decrypt(user.claudeApiKey).slice(-4)}` : "",
      openaiApiKey: user.openaiApiKey ? `****${decrypt(user.openaiApiKey).slice(-4)}` : "",
      aiProvider: user.aiProvider || "claude",
      elevenLabsApiKey: user.elevenLabsApiKey ? `****${decrypt(user.elevenLabsApiKey).slice(-4)}` : "",
      heygenApiKey: user.heygenApiKey ? `****${decrypt(user.heygenApiKey).slice(-4)}` : "",
      heygenAvatarId: user.heygenAvatarId || "",
      elevenLabsVoiceId: user.elevenLabsVoiceId || "",
      hasClaudeKey: !!user.claudeApiKey,
      hasOpenaiKey: !!user.openaiApiKey,
      hasElevenLabsKey: !!user.elevenLabsApiKey,
      hasHeygenKey: !!user.heygenApiKey,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(req: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorized();

    const body = await req.json();
    const {
      claudeApiKey,
      openaiApiKey,
      aiProvider,
      elevenLabsApiKey,
      heygenApiKey,
      heygenAvatarId,
      elevenLabsVoiceId,
    } = body;

    const updateData: Record<string, string | null> = {};

    if (claudeApiKey && !claudeApiKey.startsWith("****")) {
      updateData.claudeApiKey = encrypt(claudeApiKey);
    }
    if (openaiApiKey && !openaiApiKey.startsWith("****")) {
      updateData.openaiApiKey = encrypt(openaiApiKey);
    }
    if (aiProvider !== undefined && (aiProvider === "claude" || aiProvider === "openai")) {
      updateData.aiProvider = aiProvider;
    }
    if (elevenLabsApiKey && !elevenLabsApiKey.startsWith("****")) {
      updateData.elevenLabsApiKey = encrypt(elevenLabsApiKey);
    }
    if (heygenApiKey && !heygenApiKey.startsWith("****")) {
      updateData.heygenApiKey = encrypt(heygenApiKey);
    }
    if (heygenAvatarId !== undefined) {
      updateData.heygenAvatarId = heygenAvatarId || null;
    }
    if (elevenLabsVoiceId !== undefined) {
      updateData.elevenLabsVoiceId = elevenLabsVoiceId || null;
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
