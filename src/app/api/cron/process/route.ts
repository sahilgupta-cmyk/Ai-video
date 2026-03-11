import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkVideoStatus } from "@/lib/services/avatar-service";
import { runVideoPipeline } from "@/lib/services/pipeline";

export async function POST(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Poll HeyGen for videos in GENERATING_VIDEO status
    const generatingVideos = await prisma.video.findMany({
      where: { status: "GENERATING_VIDEO", heygenVideoId: { not: null } },
      include: { user: true },
    });

    for (const video of generatingVideos) {
      if (!video.heygenVideoId || !video.user.heygenApiKey) continue;

      try {
        const status = await checkVideoStatus(
          video.heygenVideoId,
          video.user.heygenApiKey
        );

        if (status.status === "completed") {
          await prisma.video.update({
            where: { id: video.id },
            data: {
              status: "COMPLETED",
              videoUrl: status.videoUrl,
              thumbnailUrl: status.thumbnailUrl,
              duration: status.duration,
            },
          });
        } else if (status.status === "failed") {
          await prisma.video.update({
            where: { id: video.id },
            data: {
              status: "FAILED",
              errorMessage: status.error,
            },
          });
        }
      } catch (error) {
        console.error(`Error polling video ${video.id}:`, error);
      }
    }

    // 2. Process due schedules
    const dueSchedules = await prisma.schedule.findMany({
      where: {
        active: true,
        nextRunAt: { lte: new Date() },
      },
      include: { user: true },
    });

    for (const schedule of dueSchedules) {
      try {
        let topic: string;

        if (schedule.topicSource === "FROM_LIST") {
          const unusedTopic = await prisma.topic.findFirst({
            where: { userId: schedule.userId, used: false },
            orderBy: { createdAt: "asc" },
          });

          if (!unusedTopic) {
            console.log(`No unused topics for schedule ${schedule.id}`);
            continue;
          }

          topic = unusedTopic.title;
          await prisma.topic.update({
            where: { id: unusedTopic.id },
            data: { used: true },
          });
        } else {
          topic = "Latest Claude AI features and updates";
        }

        const video = await prisma.video.create({
          data: {
            userId: schedule.userId,
            topic,
            status: "PENDING",
          },
        });

        runVideoPipeline(video.id).catch(console.error);

        // Update schedule timing
        const nextRunMs =
          schedule.frequency === "HOURLY"
            ? 60 * 60 * 1000
            : schedule.frequency === "DAILY"
            ? 24 * 60 * 60 * 1000
            : 7 * 24 * 60 * 60 * 1000;

        await prisma.schedule.update({
          where: { id: schedule.id },
          data: {
            lastRunAt: new Date(),
            nextRunAt: new Date(Date.now() + nextRunMs),
          },
        });
      } catch (error) {
        console.error(`Error processing schedule ${schedule.id}:`, error);
      }
    }

    return NextResponse.json({
      polled: generatingVideos.length,
      schedulesProcessed: dueSchedules.length,
    });
  } catch (error) {
    console.error("Cron error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Also support GET for Vercel Cron
export async function GET(req: Request) {
  return POST(req);
}
