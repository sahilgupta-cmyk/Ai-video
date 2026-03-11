"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { VideoRecord } from "@/types";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "success" | "warning"> = {
  PENDING: "secondary",
  GENERATING_SCRIPT: "warning",
  GENERATING_AUDIO: "warning",
  GENERATING_VIDEO: "warning",
  COMPLETED: "success",
  FAILED: "destructive",
};

export default function VideoDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [video, setVideo] = useState<VideoRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchVideo = useCallback(async () => {
    try {
      const res = await fetch(`/api/videos/${id}`);
      if (res.ok) {
        setVideo(await res.json());
      } else {
        router.push("/videos");
      }
    } catch {
      console.error("Failed to fetch video");
    }
  }, [id, router]);

  useEffect(() => {
    fetchVideo().finally(() => setLoading(false));

    const interval = setInterval(fetchVideo, 5000);
    return () => clearInterval(interval);
  }, [fetchVideo]);

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!video) return null;

  const isProcessing = !["COMPLETED", "FAILED"].includes(video.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.push("/videos")}>
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{video.topic}</h1>
          <p className="text-muted-foreground">
            Created {new Date(video.createdAt).toLocaleString()}
          </p>
        </div>
        <Badge variant={statusVariant[video.status] || "secondary"} className="text-sm">
          {video.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Video Player */}
      {video.videoUrl && (
        <Card>
          <CardContent className="p-0">
            <video
              src={video.videoUrl}
              controls
              className="w-full rounded-lg"
              poster={video.thumbnailUrl || undefined}
            />
          </CardContent>
        </Card>
      )}

      {isProcessing && (
        <Card>
          <CardContent className="py-10 text-center">
            <div className="animate-pulse">
              <p className="text-lg font-medium">Processing your video...</p>
              <p className="text-muted-foreground mt-1">
                Current step: {video.status.replace(/_/g, " ").toLowerCase()}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                This page auto-refreshes every 5 seconds
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {video.status === "FAILED" && video.errorMessage && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{video.errorMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {video.status === "COMPLETED" && video.videoUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3">
            <a
              href={video.videoUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Download Video
            </a>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(video.videoUrl!);
                alert("Video URL copied to clipboard!");
              }}
            >
              Copy Share Link
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Script */}
      {video.script && (
        <Card>
          <CardHeader>
            <CardTitle>Script</CardTitle>
            <CardDescription>Generated podcast script</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg max-h-96 overflow-y-auto">
              {video.script}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">ID</dt>
              <dd className="font-mono">{video.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd>{video.status}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{new Date(video.createdAt).toLocaleString()}</dd>
            </div>
            {video.duration && (
              <div>
                <dt className="text-muted-foreground">Duration</dt>
                <dd>{Math.floor(video.duration / 60)}m {video.duration % 60}s</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
