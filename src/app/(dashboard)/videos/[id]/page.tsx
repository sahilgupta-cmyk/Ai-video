"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VideoRecord } from "@/types";

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

type StepStatus = "completed" | "active" | "waiting" | "locked" | "unavailable";

function getStepStatuses(
  videoStatus: string,
  hasAudio: boolean,
  hasVideo: boolean
): { script: StepStatus; audio: StepStatus; video: StepStatus } {
  const statusOrder = [
    "PENDING",
    "GENERATING_SCRIPT",
    "SCRIPT_READY",
    "GENERATING_AUDIO",
    "AUDIO_READY",
    "GENERATING_VIDEO",
    "COMPLETED",
    "FAILED",
  ];

  const idx = statusOrder.indexOf(videoStatus);

  // Script step
  let script: StepStatus = "locked";
  if (idx > 2) script = "completed"; // Beyond SCRIPT_READY
  else if (idx === 2) script = "completed"; // SCRIPT_READY (script is done, awaiting user action)
  else if (idx === 1) script = "active"; // GENERATING_SCRIPT
  else if (idx === 0) script = "waiting"; // PENDING

  // Audio step
  let audio: StepStatus = !hasAudio ? "unavailable" : "locked";
  if (hasAudio) {
    if (idx >= 4) audio = "completed"; // AUDIO_READY or beyond
    else if (idx === 3) audio = "active"; // GENERATING_AUDIO
    else if (idx === 2) audio = "waiting"; // SCRIPT_READY (waiting for approval)
  }

  // Video step
  let video: StepStatus = !hasVideo ? "unavailable" : "locked";
  if (hasVideo) {
    if (videoStatus === "COMPLETED") video = "completed";
    else if (idx === 5) video = "active"; // GENERATING_VIDEO
    else if (idx === 4) video = "waiting"; // AUDIO_READY
    else if (!hasAudio && idx === 2) video = "waiting"; // No audio, waiting after script
  }

  // If FAILED, mark the current active step
  if (videoStatus === "FAILED") {
    script = idx <= 1 ? "active" : "completed";
    if (hasAudio) audio = idx >= 2 && idx <= 3 ? "active" : idx >= 4 ? "completed" : "locked";
    if (hasVideo) video = idx >= 4 ? "active" : "locked";
  }

  return { script, audio, video };
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "completed")
    return <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">&#10003;</div>;
  if (status === "active")
    return <div className="w-8 h-8 rounded-full bg-yellow-500 animate-pulse flex items-center justify-center text-white text-sm font-bold">&#9679;</div>;
  if (status === "waiting")
    return <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">&#8987;</div>;
  if (status === "unavailable")
    return <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm">&#10007;</div>;
  return <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm">&#8226;</div>;
}

function StepLabel({ status }: { status: StepStatus }) {
  if (status === "completed") return <span className="text-green-600 text-xs font-medium">Complete</span>;
  if (status === "active") return <span className="text-yellow-600 text-xs font-medium">In Progress</span>;
  if (status === "waiting") return <span className="text-blue-600 text-xs font-medium">Awaiting Approval</span>;
  if (status === "unavailable") return <span className="text-muted-foreground text-xs">API Key Required</span>;
  return <span className="text-muted-foreground text-xs">Pending</span>;
}

export default function VideoDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [video, setVideo] = useState<VideoRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState({ hasClaudeKey: false, hasOpenaiKey: false, hasElevenLabsKey: false, hasHeygenKey: false });
  const [editingScript, setEditingScript] = useState(false);
  const [editedScript, setEditedScript] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [voiceInstructions, setVoiceInstructions] = useState("");

  const fetchVideo = useCallback(async () => {
    try {
      const res = await fetch(`/api/videos/${id}`);
      if (res.ok) {
        const data = await res.json();
        setVideo(data);
        if (!editingScript) setEditedScript(data.script || "");
      } else {
        router.push("/videos");
      }
    } catch {
      console.error("Failed to fetch video");
    }
  }, [id, router, editingScript]);

  // Auto-trigger script generation when video is PENDING
  useEffect(() => {
    if (!video || video.status !== "PENDING" || generating) return;
    setGenerating(true);
    fetch(`/api/videos/${id}/generate`, { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.id) {
          setVideo(data);
          setEditedScript(data.script || "");
        } else {
          // Error — refetch to get latest status
          fetchVideo();
        }
      })
      .catch(() => fetchVideo())
      .finally(() => setGenerating(false));
  }, [video, id, generating, fetchVideo]);

  useEffect(() => {
    fetchVideo().finally(() => setLoading(false));
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) =>
        setApiKeys({
          hasClaudeKey: data.hasClaudeKey || false,
          hasOpenaiKey: data.hasOpenaiKey || false,
          hasElevenLabsKey: data.hasElevenLabsKey || false,
          hasHeygenKey: data.hasHeygenKey || false,
        })
      )
      .catch(console.error);
  }, [fetchVideo]);

  useEffect(() => {
    if (!video) return;
    const needsPolling = ["GENERATING_AUDIO", "GENERATING_VIDEO"].includes(video.status);
    if (!needsPolling) return;
    const interval = setInterval(fetchVideo, 5000);
    return () => clearInterval(interval);
  }, [video, fetchVideo]);

  async function handleApprove(action: "approve" | "regenerate") {
    setActionLoading(true);
    try {
      const body: Record<string, string> = { action };
      if (action === "approve" && editingScript && editedScript.trim() !== video?.script) {
        body.editedScript = editedScript;
      }
      if (voiceInstructions.trim()) {
        body.voiceInstructions = voiceInstructions.trim();
      }
      const res = await fetch(`/api/videos/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.video) {
        setVideo(data.video);
        if (!editingScript) setEditedScript(data.video.script || "");
      } else {
        // Fallback: refetch
        await fetchVideo();
      }
      setEditingScript(false);
    } catch (error) {
      console.error("Action failed:", error);
      await fetchVideo();
    }
    setActionLoading(false);
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!video) return null;

  const steps = getStepStatuses(video.status, apiKeys.hasElevenLabsKey, apiKeys.hasHeygenKey);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.push("/videos")}>
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{video.topic}</h1>
          <p className="text-muted-foreground">
            Created {new Date(video.createdAt).toLocaleString()}
            {video.autoApprove && " · Auto-approve enabled"}
          </p>
        </div>
        <Badge variant={statusVariant[video.status] || "secondary"} className="text-sm">
          {video.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Error */}
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

      {/* Pipeline Stepper */}
      <div className="space-y-4">
        {/* Step 1: Script */}
        <Card className={steps.script === "active" ? "border-yellow-500" : steps.script === "waiting" ? "border-blue-500" : ""}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <StepIcon status={steps.script} />
              <div className="flex-1">
                <CardTitle className="text-lg">Step 1: Script</CardTitle>
                <StepLabel status={steps.script} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(video.status === "PENDING" || video.status === "GENERATING_SCRIPT") && !video.script && (
              <div className="animate-pulse text-muted-foreground">Generating script... This may take a moment.</div>
            )}
            {video.script && (
              <>
                {editingScript ? (
                  <Textarea
                    value={editedScript}
                    onChange={(e) => setEditedScript(e.target.value)}
                    rows={12}
                    className="font-mono text-sm"
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg max-h-80 overflow-y-auto">
                    {video.script}
                  </div>
                )}
                {video.status === "SCRIPT_READY" && (
                  <div className="mt-4 space-y-4">
                    {/* Voice Instructions */}
                    <div className="space-y-2 p-4 bg-muted/50 rounded-lg border">
                      <Label className="text-sm font-medium">Voice Instructions (optional)</Label>
                      <Input
                        placeholder="e.g., Speak slowly and calmly, with emphasis on key points..."
                        value={voiceInstructions}
                        onChange={(e) => setVoiceInstructions(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Add directions for how the script should be read aloud (tone, pace, emphasis, etc.)
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApprove("approve")}
                        disabled={actionLoading}
                      >
                        {actionLoading ? "Generating Audio..." : "Next: Generate Audio"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleApprove("regenerate")}
                        disabled={actionLoading}
                      >
                        Regenerate Script
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditingScript(!editingScript);
                          if (!editingScript) setEditedScript(video.script || "");
                        }}
                      >
                        {editingScript ? "Cancel Edit" : "Edit Script"}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Audio */}
        <Card className={
          steps.audio === "unavailable" ? "opacity-60" :
          steps.audio === "active" ? "border-yellow-500" :
          steps.audio === "waiting" ? "border-blue-500" : ""
        }>
          <CardHeader>
            <div className="flex items-center gap-3">
              <StepIcon status={steps.audio} />
              <div className="flex-1">
                <CardTitle className="text-lg">Step 2: Audio</CardTitle>
                <StepLabel status={steps.audio} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {steps.audio === "unavailable" && (
              <p className="text-sm text-muted-foreground">
                ElevenLabs API key and Voice ID required. Configure in Settings.
              </p>
            )}
            {steps.audio === "active" && (
              <div className="animate-pulse text-muted-foreground">Generating audio...</div>
            )}
            {steps.audio === "locked" && (
              <p className="text-sm text-muted-foreground">Waiting for script approval...</p>
            )}
            {(video.status === "AUDIO_READY" || (steps.audio === "completed" && video.audioUrl)) && (
              <>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-3">Audio generated successfully. Listen below:</p>
                  {video.audioUrl && video.audioUrl.startsWith("/api/audio/") && (
                    <audio controls className="w-full" preload="auto">
                      <source src={video.audioUrl} type="audio/mpeg" />
                      Your browser does not support audio playback.
                    </audio>
                  )}
                  {video.audioUrl && !video.audioUrl.startsWith("/api/audio/") && video.audioUrl !== "audio-generated" && (
                    <audio controls className="w-full" preload="auto">
                      <source src={video.audioUrl} type="audio/mpeg" />
                      Your browser does not support audio playback.
                    </audio>
                  )}
                  {(!video.audioUrl || video.audioUrl === "audio-generated") && (
                    <p className="text-sm text-yellow-600">Audio was generated but no playback URL is available.</p>
                  )}
                </div>
                {video.status === "AUDIO_READY" && (
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() => handleApprove("approve")}
                      disabled={actionLoading}
                    >
                      {actionLoading ? "Processing..." : "Next: Generate Video"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleApprove("regenerate")}
                      disabled={actionLoading}
                    >
                      Regenerate Audio
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Video */}
        <Card className={
          steps.video === "unavailable" ? "opacity-60" :
          steps.video === "active" ? "border-yellow-500" :
          steps.video === "waiting" ? "border-blue-500" : ""
        }>
          <CardHeader>
            <div className="flex items-center gap-3">
              <StepIcon status={steps.video} />
              <div className="flex-1">
                <CardTitle className="text-lg">Step 3: Video</CardTitle>
                <StepLabel status={steps.video} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {steps.video === "unavailable" && (
              <p className="text-sm text-muted-foreground">
                HeyGen API key and Avatar ID required. Configure in Settings.
              </p>
            )}
            {steps.video === "active" && (
              <div className="animate-pulse text-muted-foreground">
                Generating video... This may take several minutes.
              </div>
            )}
            {steps.video === "locked" && (
              <p className="text-sm text-muted-foreground">Waiting for previous steps...</p>
            )}
            {steps.video === "waiting" && (
              <p className="text-sm text-muted-foreground">Waiting for audio approval...</p>
            )}
            {video.status === "COMPLETED" && video.videoUrl && (
              <>
                <video
                  src={video.videoUrl}
                  controls
                  className="w-full rounded-lg"
                  poster={video.thumbnailUrl || undefined}
                />
                <div className="flex gap-3 mt-4">
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
                      alert("Video URL copied!");
                    }}
                  >
                    Copy Share Link
                  </Button>
                </div>
              </>
            )}
            {video.status === "COMPLETED" && !video.videoUrl && (
              <p className="text-sm text-green-600 font-medium">
                Pipeline completed (no video step — only script{apiKeys.hasElevenLabsKey ? " and audio" : ""} generated).
              </p>
            )}
          </CardContent>
        </Card>
      </div>

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
