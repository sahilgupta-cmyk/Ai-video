"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import type { VideoRecord } from "@/types";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "success" | "warning"> = {
  PENDING: "secondary",
  GENERATING_SCRIPT: "warning",
  GENERATING_AUDIO: "warning",
  GENERATING_VIDEO: "warning",
  COMPLETED: "success",
  FAILED: "destructive",
};

export default function VideosPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const fetchVideos = useCallback(async () => {
    try {
      const res = await fetch("/api/videos");
      if (res.ok) setVideos(await res.json());
    } catch (error) {
      console.error("Failed to fetch:", error);
    }
  }, []);

  useEffect(() => {
    fetchVideos().finally(() => setLoading(false));
    const interval = setInterval(fetchVideos, 10000);
    return () => clearInterval(interval);
  }, [fetchVideos]);

  const filtered =
    filter === "ALL" ? videos : videos.filter((v) => v.status === filter);

  async function handleDelete(id: string) {
    if (!confirm("Delete this video?")) return;
    await fetch(`/api/videos/${id}`, { method: "DELETE" });
    fetchVideos();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Video Library</h1>
          <p className="text-muted-foreground">{videos.length} total videos</p>
        </div>
        <Button onClick={() => router.push("/create")}>Create New</Button>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="ALL">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="GENERATING_SCRIPT">Generating Script</option>
          <option value="GENERATING_AUDIO">Generating Audio</option>
          <option value="GENERATING_VIDEO">Generating Video</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No videos found. Create your first one!
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((video) => (
            <Card key={video.id} className="overflow-hidden">
              <div className="aspect-video bg-muted flex items-center justify-center">
                {video.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={video.thumbnailUrl}
                    alt={video.topic}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-muted-foreground text-sm">
                    {video.status === "COMPLETED" ? "Video Ready" : "Processing..."}
                  </div>
                )}
              </div>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base line-clamp-2">{video.topic}</CardTitle>
                  <Badge variant={statusVariant[video.status] || "secondary"} className="shrink-0">
                    {video.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  {new Date(video.createdAt).toLocaleDateString()}
                  {video.duration && ` - ${Math.round(video.duration / 60)}min`}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/videos/${video.id}`)}
                  >
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(video.id)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
