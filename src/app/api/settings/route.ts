import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUserId, unauthorized, serverError } from "@/lib/api-helpers";
import { encrypt, decrypt } from "@/lib/utils/encryption";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        claudeApiKey: true,
        elevenLabsApiKey: true,
        heygenApiKey: true,
        heygenAvatarId: true,
        elevenLabsVoiceId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Return masked keys (only show last 4 chars)
    return NextResponse.json({
      claudeApiKey: user.claudeApiKey ? `****${decrypt(user.claudeApiKey).slice(-4)}` : "",
      elevenLabsApiKey: user.elevenLabsApiKey ? `****${decrypt(user.elevenLabsApiKey).slice(-4)}` : "",
      heygenApiKey: user.heygenApiKey ? `****${decrypt(user.heygenApiKey).slice(-4)}` : "",
      heygenAvatarId: user.heygenAvatarId || "",
      elevenLabsVoiceId: user.elevenLabsVoiceId || "",
      hasClaudeKey: !!user.claudeApiKey,
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
      elevenLabsApiKey,
      heygenApiKey,
      heygenAvatarId,
      elevenLabsVoiceId,
    } = body;

    const updateData: Record<string, string | null> = {};

    // Only update keys that were actually provided (not masked values)
    if (claudeApiKey && !claudeApiKey.startsWith("****")) {
      updateData.claudeApiKey = encrypt(claudeApiKey);
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
