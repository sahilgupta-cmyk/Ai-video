"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function DashboardPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchVideos = useCallback(async () => {
    try {
      const res = await fetch("/api/videos");
      if (res.ok) {
        const data = await res.json();
        setVideos(data);
      }
    } catch (error) {
      console.error("Failed to fetch videos:", error);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchVideos().finally(() => setLoading(false));

    const interval = setInterval(fetchVideos, 10000);
    return () => clearInterval(interval);
  }, [fetchVideos]);

  async function handleQuickCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: [topic.trim()] }),
      });

      if (res.ok) {
        setTopic("");
        fetchVideos();
      }
    } catch (error) {
      console.error("Failed to create video:", error);
    }
    setCreating(false);
  }

  const stats = {
    total: videos.length,
    completed: videos.filter((v) => v.status === "COMPLETED").length,
    processing: videos.filter((v) =>
      ["PENDING", "GENERATING_SCRIPT", "GENERATING_AUDIO", "GENERATING_VIDEO"].includes(v.status)
    ).length,
    failed: videos.filter((v) => v.status === "FAILED").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Generate AI podcast videos from any topic</p>
      </div>

      {/* Quick Create */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Create</CardTitle>
          <CardDescription>Enter a topic and generate a podcast video instantly</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleQuickCreate} className="flex gap-3">
            <Input
              placeholder="e.g., Claude's memory feature, Claude Code, Claude's web search..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={creating || !topic.trim()}>
              {creating ? "Creating..." : "Generate Video"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Videos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <p className="text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{stats.processing}</div>
            <p className="text-sm text-muted-foreground">Processing</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <p className="text-sm text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Videos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Videos</CardTitle>
            <CardDescription>Your latest generated videos</CardDescription>
          </div>
          <Button variant="outline" onClick={() => router.push("/videos")}>
            View All
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : videos.length === 0 ? (
            <p className="text-muted-foreground">No videos yet. Create your first one above!</p>
          ) : (
            <div className="space-y-3">
              {videos.slice(0, 5).map((video) => (
                <div
                  key={video.id}
                  className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => router.push(`/videos/${video.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{video.topic}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(video.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={statusVariant[video.status] || "secondary"}>
                    {video.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
