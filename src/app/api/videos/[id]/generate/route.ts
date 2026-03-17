import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUserId, unauthorized, badRequest, serverError } from "@/lib/api-helpers";
import { generateScript } from "@/lib/services/script-generator";
import { getTargetWords } from "@/lib/constants";

export const dynamic = "force-dynamic";


export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorized();

    const video = await prisma.video.findFirst({
      where: { id: params.id, userId },
    });

    if (!video) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (video.status !== "PENDING") {
      return NextResponse.json({ error: "Video is not in PENDING status", status: video.status }, { status: 400 });
    }

    // Update status to GENERATING_SCRIPT
    await prisma.video.update({
      where: { id: video.id },
      data: { status: "GENERATING_SCRIPT" },
    });

    // Get user's AI config
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        claudeApiKey: true,
        openaiApiKey: true,
        aiProvider: true,
      },
    });

    if (!user) {
      await prisma.video.update({
        where: { id: video.id },
        data: { status: "FAILED", errorMessage: "User not found" },
      });
      return badRequest("User not found");
    }

    // Determine which provider and key to use
    const provider = (user.aiProvider || "claude") as "claude" | "openai";
    let apiKey: string | null = null;
    let selectedProvider: "claude" | "openai" = provider;

    if (provider === "openai" && user.openaiApiKey) {
      apiKey = user.openaiApiKey;
    } else if (provider === "claude" && user.claudeApiKey) {
      apiKey = user.claudeApiKey;
    } else if (user.claudeApiKey) {
      apiKey = user.claudeApiKey;
      selectedProvider = "claude";
    } else if (user.openaiApiKey) {
      apiKey = user.openaiApiKey;
      selectedProvider = "openai";
    }

    if (!apiKey) {
      await prisma.video.update({
        where: { id: video.id },
        data: { status: "FAILED", errorMessage: "No AI API key configured. Please add a Claude or OpenAI key in Settings." },
      });
      return badRequest("No AI API key configured");
    }

    try {
      const targetWords = getTargetWords(video.contentFormat, video.targetDuration);
      const { script, voiceStyle } = await generateScript({
        topic: video.topic,
        userId,
        apiKey,
        provider: selectedProvider,
        contentFormat: video.contentFormat,
        targetDuration: video.targetDuration,
        targetWords,
      });

      const updated = await prisma.video.update({
        where: { id: video.id },
        data: { script, voiceStyle, status: "SCRIPT_READY" },
      });

      return NextResponse.json(updated);
    } catch (genError) {
      const errorMessage = genError instanceof Error ? genError.message : "Script generation failed";
      await prisma.video.update({
        where: { id: video.id },
        data: { status: "FAILED", errorMessage },
      });
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (error) {
    return serverError(error);
  }
}
