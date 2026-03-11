import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUserId, unauthorized, badRequest, serverError } from "@/lib/api-helpers";

function getNextRunAt(frequency: string): Date {
  const now = new Date();
  switch (frequency) {
    case "HOURLY":
      return new Date(now.getTime() + 60 * 60 * 1000);
    case "DAILY":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "WEEKLY":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorized();

    const schedules = await prisma.schedule.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(schedules);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorized();

    const body = await req.json();
    const { frequency, cronExpr, topicSource } = body;

    if (!frequency) {
      return badRequest("Frequency is required");
    }

    const schedule = await prisma.schedule.create({
      data: {
        userId,
        frequency,
        cronExpr: cronExpr || null,
        topicSource: topicSource || "FROM_LIST",
        nextRunAt: getNextRunAt(frequency),
      },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
