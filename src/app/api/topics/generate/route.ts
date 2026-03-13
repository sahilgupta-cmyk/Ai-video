import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUserId, unauthorized, badRequest, serverError } from "@/lib/api-helpers";
import { decrypt } from "@/lib/utils/encryption";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorized();

    const body = await req.json();
    const { count, prompt, category } = body as {
      count: number;
      prompt: string;
      category?: string;
    };

    if (!prompt || !prompt.trim()) {
      return badRequest("Prompt is required");
    }

    const numTopics = Math.min(Math.max(count || 5, 1), 50);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { claudeApiKey: true },
    });

    if (!user?.claudeApiKey) {
      return badRequest("Claude API key is required to generate topics. Please configure it in Settings.");
    }

    const decryptedKey = decrypt(user.claudeApiKey);
    const client = new Anthropic({ apiKey: decryptedKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You are a topic generator for a podcast. Generate exactly ${numTopics} unique, specific, and engaging podcast topic titles. Return ONLY a JSON array of strings, no other text. Example: ["Topic 1", "Topic 2"]`,
      messages: [
        {
          role: "user",
          content: `Generate ${numTopics} podcast topics about: ${prompt.trim()}${category ? ` (category: ${category})` : ""}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return badRequest("Failed to generate topics");
    }

    // Parse the JSON array from the response
    const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return badRequest("Failed to parse generated topics");
    }

    const topics: string[] = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ topics, category: category || null });
  } catch (error) {
    return serverError(error);
  }
}
