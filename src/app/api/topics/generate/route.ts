import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUserId, unauthorized, badRequest, serverError } from "@/lib/api-helpers";
import { decrypt } from "@/lib/utils/encryption";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

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
      select: { claudeApiKey: true, openaiApiKey: true, aiProvider: true },
    });

    if (!user) {
      return badRequest("User not found");
    }

    const systemPrompt = `You are a topic generator for a podcast. Generate exactly ${numTopics} unique, specific, and engaging podcast topic titles. Return ONLY a JSON array of strings, no other text. Example: ["Topic 1", "Topic 2"]`;
    const userMessage = `Generate ${numTopics} podcast topics about: ${prompt.trim()}${category ? ` (category: ${category})` : ""}`;

    let responseText: string;

    if (user.aiProvider === "openai" && user.openaiApiKey) {
      const client = new OpenAI({ apiKey: decrypt(user.openaiApiKey) });
      const completion = await client.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 1024,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      });
      responseText = completion.choices[0]?.message?.content || "";
    } else if (user.claudeApiKey) {
      const client = new Anthropic({ apiKey: decrypt(user.claudeApiKey) });
      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });
      const textBlock = message.content.find((block) => block.type === "text");
      responseText = textBlock && textBlock.type === "text" ? textBlock.text : "";
    } else if (user.openaiApiKey) {
      const client = new OpenAI({ apiKey: decrypt(user.openaiApiKey) });
      const completion = await client.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 1024,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      });
      responseText = completion.choices[0]?.message?.content || "";
    } else {
      return badRequest("No AI API key configured. Please add a Claude or OpenAI key in Settings.");
    }

    if (!responseText) {
      return badRequest("Failed to generate topics");
    }

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return badRequest("Failed to parse generated topics");
    }

    const topics: string[] = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ topics, category: category || null });
  } catch (error) {
    return serverError(error);
  }
}
