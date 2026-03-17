import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/utils/encryption";
import { VOICE_STYLES } from "@/lib/constants";

interface GenerateScriptOptions {
  topic: string;
  userId: string;
  apiKey: string;
  provider: "claude" | "openai";
  contentFormat?: string | null;
  targetDuration?: number | null;
  targetWords?: number | null;
}

interface ScriptResult {
  script: string;
  voiceStyle: string;
}

export async function generateScript({
  topic,
  userId,
  apiKey,
  provider,
  contentFormat,
  targetDuration,
  targetWords,
}: GenerateScriptOptions): Promise<ScriptResult> {
  const memories = await prisma.projectMemory.findMany({
    where: { userId },
  });

  const memoryContext = memories
    .map((m) => `${m.key}: ${m.value}`)
    .join("\n");

  const systemPrompt = buildSystemPrompt(memoryContext, contentFormat, targetDuration, targetWords);
  const userMessage = `Write a ${contentFormat === "short_form" ? "short-form reel script" : "podcast script"} about the following topic: ${topic}`;
  const decryptedKey = decrypt(apiKey);

  const voiceStyle =
    contentFormat === "short_form"
      ? VOICE_STYLES.short_form
      : VOICE_STYLES.long_form;

  let script: string;
  if (provider === "openai") {
    script = await generateWithOpenAI(decryptedKey, systemPrompt, userMessage);
  } else {
    script = await generateWithClaude(decryptedKey, systemPrompt, userMessage);
  }

  return { script, voiceStyle };
}

function buildSystemPrompt(
  memoryContext: string,
  contentFormat?: string | null,
  targetDuration?: number | null,
  targetWords?: number | null
): string {
  const memoryBlock = memoryContext
    ? `The user has provided the following writing instructions:\n${memoryContext}\n\n`
    : "";

  if (contentFormat === "short_form") {
    const durationStr = targetDuration
      ? `${targetDuration} seconds`
      : "60 seconds";
    const wordStr = targetWords ? `${targetWords}` : "160";

    return `You are a viral short-form content writer for social media reels and shorts.

${memoryBlock}CRITICAL RULES:
- Open with a powerful hook in the FIRST sentence — use a provocative question, bold claim, or surprising fact to stop the scroll
- Get to the point IMMEDIATELY — no "welcome", "hey guys", or any preamble
- Use punchy, direct, high-energy language throughout
- Every single sentence must earn its place — cut ALL filler ruthlessly
- Build tension or curiosity that keeps viewers watching till the end
- End with a strong call-to-action, cliffhanger, or memorable one-liner
- Keep the script under ${wordStr} words (approximately ${durationStr} when read aloud)
- Do NOT include stage directions, sound effects, or speaker labels
- Write as continuous spoken text ready to be read aloud
- Use short sentences. Vary rhythm. Create urgency.`;
  }

  // Long-form prompt
  const durationMin = targetDuration
    ? Math.round(targetDuration / 60)
    : 3;
  const wordStr = targetWords ? `${targetWords}` : "450";

  return `You are a professional podcast script writer. Write engaging, conversational podcast scripts about AI technology.

${memoryBlock}Guidelines:
- Write in a natural, conversational tone as if speaking to an audience
- Include an engaging introduction and a clear conclusion
- Use transitions between topics
- Keep the script around ${wordStr} words (roughly ${durationMin} minutes of speaking time)
- Do NOT include stage directions, sound effects, or speaker labels
- Write the script as continuous spoken text ready to be read aloud`;
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
