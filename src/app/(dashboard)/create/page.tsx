"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SHORT_FORM_DURATIONS, LONG_FORM_DURATIONS } from "@/lib/constants";

type ContentFormat = "long_form" | "short_form";
type VideoFormatType = "landscape" | "portrait" | "square";

export default function CreatePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [singleTopic, setSingleTopic] = useState("");
  const [batchTopics, setBatchTopics] = useState("");
  const [autoApprove, setAutoApprove] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [contentFormat, setContentFormat] = useState<ContentFormat>("long_form");
  const [targetDuration, setTargetDuration] = useState<number>(180);
  const [videoFormat, setVideoFormat] = useState<VideoFormatType>("landscape");
  const [apiKeys, setApiKeys] = useState({
    hasClaudeKey: false,
    hasOpenaiKey: false,
    hasElevenLabsKey: false,
    hasHeygenKey: false,
    aiProvider: "claude" as string,
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) =>
        setApiKeys({
          hasClaudeKey: data.hasClaudeKey || false,
          hasOpenaiKey: data.hasOpenaiKey || false,
          hasElevenLabsKey: data.hasElevenLabsKey || false,
          hasHeygenKey: data.hasHeygenKey || false,
          aiProvider: data.aiProvider || "claude",
        })
      )
      .catch(console.error);
  }, []);

  function handleContentFormatChange(format: ContentFormat) {
    setContentFormat(format);
    if (format === "short_form") {
      setVideoFormat("portrait");
      setTargetDuration(60);
    } else {
      setVideoFormat("landscape");
      setTargetDuration(180);
    }
  }

  const durations = contentFormat === "short_form" ? SHORT_FORM_DURATIONS : LONG_FORM_DURATIONS;

  async function handleCreate() {
    setError("");
    let topics: string[];

    if (mode === "single") {
      if (!singleTopic.trim()) {
        setError("Please enter a topic");
        return;
      }
      topics = [singleTopic.trim()];
    } else {
      topics = batchTopics
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean);
      if (topics.length === 0) {
        setError("Please enter at least one topic");
        return;
      }
    }

    const hasAnyAiKey = apiKeys.hasClaudeKey || apiKeys.hasOpenaiKey;
    if (!hasAnyAiKey) {
      setError("An AI API key (Claude or OpenAI) is required. Please configure one in Settings.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics,
          autoApprove,
          contentFormat,
          targetDuration,
          videoFormat,
        }),
      });

      if (res.ok) {
        const videos = await res.json();
        if (videos.length === 1) {
          router.push(`/videos/${videos[0].id}`);
        } else {
          router.push("/videos");
        }
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create videos");
      }
    } catch {
      setError("Something went wrong");
    }
    setCreating(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Videos</h1>
        <p className="text-muted-foreground">Generate one or multiple podcast videos at once</p>
      </div>

      {/* API Availability */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Status</CardTitle>
          <CardDescription>Steps available based on your configured API keys</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${(apiKeys.hasClaudeKey || apiKeys.hasOpenaiKey) ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-sm">
                Script ({apiKeys.aiProvider === "openai" ? "OpenAI" : "Claude"}{" "}
                {(apiKeys.hasClaudeKey || apiKeys.hasOpenaiKey) ? "" : "— no API key"})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${apiKeys.hasElevenLabsKey ? "bg-green-500" : "bg-yellow-500"}`} />
              <span className="text-sm">
                Audio (ElevenLabs){!apiKeys.hasElevenLabsKey && " — will skip"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${apiKeys.hasHeygenKey ? "bg-green-500" : "bg-yellow-500"}`} />
              <span className="text-sm">
                Video (HeyGen){!apiKeys.hasHeygenKey && " — will skip"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <Button
          variant={mode === "single" ? "default" : "outline"}
          onClick={() => setMode("single")}
        >
          Single Video
        </Button>
        <Button
          variant={mode === "batch" ? "default" : "outline"}
          onClick={() => setMode("batch")}
        >
          Batch Create
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {mode === "single" ? "Create a Video" : "Batch Create Videos"}
          </CardTitle>
          <CardDescription>
            {mode === "single"
              ? "Enter a topic to generate a podcast video"
              : "Enter one topic per line to create multiple videos"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}

          {mode === "single" ? (
            <div className="space-y-2">
              <Label>Topic</Label>
              <Input
                placeholder="e.g., Claude's memory feature"
                value={singleTopic}
                onChange={(e) => setSingleTopic(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Topics (one per line)</Label>
              <Textarea
                placeholder={"Claude's memory feature\nClaude Code IDE integration\nClaude's web search capabilities"}
                value={batchTopics}
                onChange={(e) => setBatchTopics(e.target.value)}
                rows={8}
              />
              <p className="text-sm text-muted-foreground">
                {batchTopics.split("\n").filter((t) => t.trim()).length} topics
              </p>
            </div>
          )}

          {/* Content Format */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Content Format</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={contentFormat === "long_form" ? "default" : "outline"}
                onClick={() => handleContentFormatChange("long_form")}
                className="flex-1"
              >
                Long Form
              </Button>
              <Button
                type="button"
                variant={contentFormat === "short_form" ? "default" : "outline"}
                onClick={() => handleContentFormatChange("short_form")}
                className="flex-1"
              >
                Short Form (Reels)
              </Button>
            </div>
            {contentFormat === "short_form" && (
              <p className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400 p-2 rounded">
                Script will be optimized with attention-grabbing hooks, punchy delivery, and reel best practices. Voice will be auto-set to energetic, fast-paced delivery.
              </p>
            )}
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Duration</Label>
            <Select
              value={String(targetDuration)}
              onChange={(e) => setTargetDuration(Number(e.target.value))}
            >
              {durations.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label} (~{d.words} words)
                </option>
              ))}
            </Select>
          </div>

          {/* Video Format */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Video Format</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={videoFormat === "landscape" ? "default" : "outline"}
                onClick={() => setVideoFormat("landscape")}
                className="flex-1"
              >
                <span className="flex items-center gap-2">
                  <span className="inline-block w-6 h-4 border-2 border-current rounded-sm" />
                  16:9
                </span>
              </Button>
              <Button
                type="button"
                variant={videoFormat === "portrait" ? "default" : "outline"}
                onClick={() => setVideoFormat("portrait")}
                className="flex-1"
              >
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3 h-5 border-2 border-current rounded-sm" />
                  9:16
                </span>
              </Button>
              <Button
                type="button"
                variant={videoFormat === "square" ? "default" : "outline"}
                onClick={() => setVideoFormat("square")}
                className="flex-1"
              >
                <span className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-current rounded-sm" />
                  1:1
                </span>
              </Button>
            </div>
          </div>

          {/* Auto-approve toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label className="text-sm font-medium">Auto-approve all steps</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Skip manual review — pipeline runs automatically through all steps
              </p>
            </div>
            <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
          </div>

          <Button onClick={handleCreate} disabled={creating || !(apiKeys.hasClaudeKey || apiKeys.hasOpenaiKey)} className="w-full">
            {creating
              ? "Creating..."
              : mode === "single"
              ? "Generate Video"
              : `Generate ${batchTopics.split("\n").filter((t) => t.trim()).length} Videos`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
