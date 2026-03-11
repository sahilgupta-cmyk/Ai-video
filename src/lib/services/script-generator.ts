import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/utils/encryption";

interface GenerateScriptOptions {
  topic: string;
  userId: string;
  apiKey: string;
}

export async function generateScript({ topic, userId, apiKey }: GenerateScriptOptions): Promise<string> {
  const memories = await prisma.projectMemory.findMany({
    where: { userId },
  });

  const memoryContext = memories
    .map((m) => `${m.key}: ${m.value}`)
    .join("\n");

  const decryptedKey = decrypt(apiKey);
  const client = new Anthropic({ apiKey: decryptedKey });

  const systemPrompt = `You are a professional podcast script writer. Write engaging, conversational podcast scripts about AI technology.

${memoryContext ? `The user has provided the following writing instructions:\n${memoryContext}\n` : ""}

Guidelines:
- Write in a natural, conversational tone as if speaking to an audience
- Include an engaging introduction and a clear conclusion
- Use transitions between topics
- Keep the script between 2-5 minutes of speaking time (roughly 300-750 words)
- Do NOT include stage directions, sound effects, or speaker labels
- Write the script as continuous spoken text ready to be read aloud`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Write a podcast script about the following topic: ${topic}`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return textBlock.text;
}
