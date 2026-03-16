import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUserId, unauthorized, serverError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return unauthorized();

    const results = await prisma.topic.findMany({
      where: { userId, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });

    const categories = results
      .map((r) => r.category)
      .filter((c): c is string => c !== null);

    return NextResponse.json({ categories });
  } catch (error) {
    return serverError(error);
  }
}
