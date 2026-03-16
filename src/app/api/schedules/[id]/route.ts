import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUserId, unauthorized, serverError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorized();

    const body = await req.json();
    const { active, frequency, cronExpr, topicSource } = body;

    const schedule = await prisma.schedule.updateMany({
      where: { id: params.id, userId },
      data: {
        ...(active !== undefined && { active }),
        ...(frequency !== undefined && { frequency }),
        ...(cronExpr !== undefined && { cronExpr }),
        ...(topicSource !== undefined && { topicSource }),
      },
    });

    if (schedule.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorized();

    await prisma.schedule.deleteMany({
      where: { id: params.id, userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
