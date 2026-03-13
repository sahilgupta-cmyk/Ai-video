import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/utils/encryption";

interface GenerateScriptOptions {
  topic: string;
  userId: string;
  apiKey: string;
  provider: "claude" | "openai";
}

export async function generateScript({ topic, userId, apiKey, provider }: GenerateScriptOptions): Promise<string> {
  const memories = await prisma.projectMemory.findMany({
    where: { userId },
  });

  const memoryContext = memories
    .map((m) => `${m.key}: ${m.value}`)
    .join("\n");

  const systemPrompt = `You are a professional podcast script writer. Write engaging, conversational podcast scripts about AI technology.

${memoryContext ? `The user has provided the following writing instructions:\n${memoryContext}\n` : ""}

Guidelines:
- Write in a natural, conversational tone as if speaking to an audience
- Include an engaging introduction and a clear conclusion
- Use transitions between topics
- Keep the script between 2-5 minutes of speaking time (roughly 300-750 words)
- Do NOT include stage directions, sound effects, or speaker labels
- Write the script as continuous spoken text ready to be read aloud`;

  const userMessage = `Write a podcast script about the following topic: ${topic}`;
  const decryptedKey = decrypt(apiKey);

  if (provider === "openai") {
    return generateWithOpenAI(decryptedKey, systemPrompt, userMessage);
  }

  return generateWithClaude(decryptedKey, systemPrompt, userMessage);
}

async function generateWithClaude(apiKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return textBlock.text;
}

async function generateWithOpenAI(apiKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 2048,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) {
    throw new Error("No text response from OpenAI");
  }

  return text;
}
