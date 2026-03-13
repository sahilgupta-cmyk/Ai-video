"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TopicRecord, VideoRecord } from "@/types";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "success" | "warning"> = {
  PENDING: "secondary",
  GENERATING_SCRIPT: "warning",
  SCRIPT_READY: "warning",
  GENERATING_AUDIO: "warning",
  AUDIO_READY: "warning",
  GENERATING_VIDEO: "warning",
  COMPLETED: "success",
  FAILED: "destructive",
};

export default function TopicDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [topic, setTopic] = useState<TopicRecord | null>(null);
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/topics/${id}/history`);
      if (res.ok) {
        const data = await res.json();
        setTopic(data.topic);
        setVideos(data.videos);
      } else {
        router.push("/topics");
      }
    } catch {
      console.error("Failed to fetch topic history");
    }
  }, [id, router]);

  useEffect(() => {
    fetchHistory().finally(() => setLoading(false));
  }, [fetchHistory]);

  async function createVideoFromTopic() {
    if (!topic) return;
    setCreating(true);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics: [topic.title],
          topicId: topic.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/videos/${data[0].id}`);
      }
    } catch {
      console.error("Failed to create video");
    }
    setCreating(false);
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!topic) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.push("/topics")}>
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{topic.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            {topic.category && <Badge variant="secondary">{topic.category}</Badge>}
            {topic.used && <Badge variant="secondary">Used</Badge>}
            <span className="text-sm text-muted-foreground">
              Added {new Date(topic.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <Button onClick={createVideoFromTopic} disabled={creating}>
          {creating ? "Creating..." : "Generate New Video"}
        </Button>
      </div>

      {topic.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{topic.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Video History */}
      <Card>
        <CardHeader>
          <CardTitle>Generation History</CardTitle>
          <CardDescription>
            {videos.length} video{videos.length !== 1 ? "s" : ""} generated from this topic
          </CardDescription>
        </CardHeader>
        <CardContent>
          {videos.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No videos generated yet. Click &quot;Generate New Video&quot; to start.
            </p>
          ) : (
            <div className="space-y-4">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/videos/${video.id}`)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant[video.status] || "secondary"}>
                        {video.status.replace(/_/g, " ")}
                      </Badge>
                      {video.autoApprove && (
                        <span className="text-xs text-muted-foreground">Auto-approve</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(video.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Pipeline Progress */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${
                        video.script ? "bg-green-500" :
                        ["GENERATING_SCRIPT", "PENDING"].includes(video.status) ? "bg-yellow-500 animate-pulse" : "bg-muted"
                      }`} />
                      <span className="text-xs">Script</span>
                    </div>
                    <div className="w-4 h-px bg-border" />
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${
                        video.audioUrl ? "bg-green-500" :
                        video.status === "GENERATING_AUDIO" ? "bg-yellow-500 animate-pulse" : "bg-muted"
                      }`} />
                      <span className="text-xs">Audio</span>
                    </div>
                    <div className="w-4 h-px bg-border" />
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${
                        video.videoUrl ? "bg-green-500" :
                        video.status === "GENERATING_VIDEO" ? "bg-yellow-500 animate-pulse" : "bg-muted"
                      }`} />
                      <span className="text-xs">Video</span>
                    </div>
                  </div>

                  {/* Script Preview */}
                  {video.script && (
                    <div className="bg-muted p-3 rounded text-xs text-muted-foreground line-clamp-3 mb-2">
                      {video.script}
                    </div>
                  )}

                  {/* Audio Player */}
                  {video.audioUrl && video.audioUrl !== "audio-generated" && (
                    <div className="mb-2" onClick={(e) => e.stopPropagation()}>
                      <audio controls className="w-full h-8">
                        <source src={video.audioUrl} type="audio/mpeg" />
                      </audio>
                    </div>
                  )}

                  {/* Video Thumbnail */}
                  {video.videoUrl && (
                    <div className="mb-2" onClick={(e) => e.stopPropagation()}>
                      <video
                        src={video.videoUrl}
                        controls
                        className="w-full rounded max-h-48"
                        poster={video.thumbnailUrl || undefined}
                      />
                    </div>
                  )}

                  {/* Error */}
                  {video.status === "FAILED" && video.errorMessage && (
                    <p className="text-xs text-destructive mt-1">{video.errorMessage}</p>
                  )}

                  {video.duration && (
                    <p className="text-xs text-muted-foreground">
                      Duration: {Math.floor(video.duration / 60)}m {video.duration % 60}s
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
