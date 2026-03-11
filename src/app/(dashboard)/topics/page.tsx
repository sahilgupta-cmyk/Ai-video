"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TopicRecord } from "@/types";

export default function TopicsPage() {
  const [topics, setTopics] = useState<TopicRecord[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [bulkTopics, setBulkTopics] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchTopics = useCallback(async () => {
    try {
      const res = await fetch("/api/topics");
      if (res.ok) setTopics(await res.json());
    } catch (error) {
      console.error("Failed to fetch topics:", error);
    }
  }, []);

  useEffect(() => {
    fetchTopics().finally(() => setLoading(false));
  }, [fetchTopics]);

  async function addTopic() {
    if (!newTopic.trim()) return;
    await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titles: [newTopic.trim()] }),
    });
    setNewTopic("");
    fetchTopics();
  }

  async function addBulkTopics() {
    const titles = bulkTopics.split("\n").filter((t) => t.trim());
    if (titles.length === 0) return;
    await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titles }),
    });
    setBulkTopics("");
    setShowBulk(false);
    fetchTopics();
  }

  async function deleteTopic(id: string) {
    await fetch(`/api/topics/${id}`, { method: "DELETE" });
    fetchTopics();
  }

  async function toggleUsed(id: string, used: boolean) {
    await fetch(`/api/topics/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ used: !used }),
    });
    fetchTopics();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Topics</h1>
        <p className="text-muted-foreground">Manage your podcast topics for scheduled generation</p>
      </div>

      {/* Add Topic */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Add Topics</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowBulk(!showBulk)}>
              {showBulk ? "Single" : "Bulk Import"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showBulk ? (
            <div className="space-y-3">
              <Textarea
                placeholder={"Claude's memory feature\nClaude Code\nClaude's web search"}
                value={bulkTopics}
                onChange={(e) => setBulkTopics(e.target.value)}
                rows={6}
              />
              <Button onClick={addBulkTopics}>
                Add {bulkTopics.split("\n").filter((t) => t.trim()).length} Topics
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Input
                placeholder="Enter a topic..."
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTopic()}
                className="flex-1"
              />
              <Button onClick={addTopic}>Add</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Topic List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Topics</CardTitle>
          <CardDescription>{topics.length} topics total</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : topics.length === 0 ? (
            <p className="text-muted-foreground">No topics yet. Add some above!</p>
          ) : (
            <div className="space-y-2">
              {topics.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <span className={topic.used ? "text-muted-foreground line-through" : ""}>
                      {topic.title}
                    </span>
                    {topic.used && <Badge variant="secondary">Used</Badge>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleUsed(topic.id, topic.used)}
                    >
                      {topic.used ? "Mark Unused" : "Mark Used"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteTopic(topic.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
