"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CreatePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [singleTopic, setSingleTopic] = useState("");
  const [batchTopics, setBatchTopics] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

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

    setCreating(true);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics }),
      });

      if (res.ok) {
        router.push("/videos");
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

          <Button onClick={handleCreate} disabled={creating} className="w-full">
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
