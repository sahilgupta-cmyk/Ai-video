import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUserId, unauthorized, serverError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(
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

    return NextResponse.json(video);
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

    await prisma.video.deleteMany({
      where: { id: params.id, userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
