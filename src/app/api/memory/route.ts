import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUserId, unauthorized, badRequest, serverError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorized();

    const memories = await prisma.projectMemory.findMany({
      where: { userId },
      orderBy: { key: "asc" },
    });

    return NextResponse.json(memories);
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(req: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorized();

    const body = await req.json();
    const { key, value } = body as { key: string; value: string };

    if (!key) return badRequest("Key is required");

    const memory = await prisma.projectMemory.upsert({
      where: { userId_key: { userId, key } },
      update: { value },
      create: { userId, key, value },
    });

    return NextResponse.json(memory);
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorized();

    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    if (!key) return badRequest("Key is required");

    await prisma.projectMemory.deleteMany({
      where: { userId, key },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
