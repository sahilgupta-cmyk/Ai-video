"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TopicRecord } from "@/types";

export default function TopicsPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<TopicRecord[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [bulkTopics, setBulkTopics] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // AI Generation state
  const [showAiGen, setShowAiGen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiCategory, setAiCategory] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{ title: string; selected: boolean }[]>([]);

  const fetchTopics = useCallback(async () => {
    try {
      const res = await fetch("/api/topics");
      if (res.ok) setTopics(await res.json());
    } catch (error) {
      console.error("Failed to fetch topics:", error);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/topics/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchTopics(), fetchCategories()]).finally(() => setLoading(false));
  }, [fetchTopics, fetchCategories]);

  async function addTopic() {
    if (!newTopic.trim()) return;
    await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titles: [newTopic.trim()],
        category: newCategory.trim() || undefined,
      }),
    });
    setNewTopic("");
    fetchTopics();
    fetchCategories();
  }

  async function addBulkTopics() {
    const titles = bulkTopics.split("\n").filter((t) => t.trim());
    if (titles.length === 0) return;
    await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titles,
        category: newCategory.trim() || undefined,
      }),
    });
    setBulkTopics("");
    setShowBulk(false);
    fetchTopics();
    fetchCategories();
  }

  async function deleteTopic(id: string) {
    await fetch(`/api/topics/${id}`, { method: "DELETE" });
    fetchTopics();
    fetchCategories();
  }

  async function toggleUsed(id: string, used: boolean) {
    await fetch(`/api/topics/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ used: !used }),
    });
    fetchTopics();
  }

  async function generateTopics() {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setAiSuggestions([]);
    try {
      const res = await fetch("/api/topics/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: aiCount,
          prompt: aiPrompt.trim(),
          category: aiCategory.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiSuggestions(
          (data.topics || []).map((t: string) => ({ title: t, selected: true }))
        );
      } else {
        const data = await res.json();
        alert(data.error || "Failed to generate topics");
      }
    } catch {
      alert("Failed to generate topics");
    }
    setAiGenerating(false);
  }

  async function saveSelectedTopics() {
    const selected = aiSuggestions.filter((s) => s.selected).map((s) => s.title);
    if (selected.length === 0) return;
    await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titles: selected,
        category: aiCategory.trim() || undefined,
      }),
    });
    setAiSuggestions([]);
    setAiPrompt("");
    fetchTopics();
    fetchCategories();
  }

  const filteredTopics =
    filterCategory === "all"
      ? topics
      : filterCategory === "uncategorized"
      ? topics.filter((t) => !t.category)
      : topics.filter((t) => t.category === filterCategory);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Topics</h1>
          <p className="text-muted-foreground">Manage your podcast topics for scheduled generation</p>
        </div>
        <Button
          variant={showAiGen ? "default" : "outline"}
          onClick={() => setShowAiGen(!showAiGen)}
        >
          {showAiGen ? "Hide AI Generator" : "Generate with AI"}
        </Button>
      </div>

      {/* AI Topic Generation */}
      {showAiGen && (
        <Card className="border-blue-500/50">
          <CardHeader>
            <CardTitle>Generate Topics with AI</CardTitle>
            <CardDescription>Describe what kind of topics you want and AI will suggest them</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Describe the topics you want</Label>
              <Input
                placeholder="e.g., AI trends in healthcare, latest Claude features, etc."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
              />
            </div>
            <div className="flex gap-4">
              <div className="space-y-2 flex-1">
                <Label>How many</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={aiCount}
                  onChange={(e) => setAiCount(parseInt(e.target.value) || 5)}
                />
              </div>
              <div className="space-y-2 flex-1">
                <Label>Category (optional)</Label>
                <Input
                  placeholder="e.g., Healthcare"
                  value={aiCategory}
                  onChange={(e) => setAiCategory(e.target.value)}
                  list="ai-categories"
                />
                <datalist id="ai-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
            <Button onClick={generateTopics} disabled={aiGenerating || !aiPrompt.trim()}>
              {aiGenerating ? "Generating..." : "Generate Topics"}
            </Button>

            {aiSuggestions.length > 0 && (
              <div className="space-y-3 mt-4">
                <p className="text-sm font-medium">
                  Generated suggestions ({aiSuggestions.filter((s) => s.selected).length} selected):
                </p>
                <div className="space-y-2">
                  {aiSuggestions.map((suggestion, idx) => (
                    <label
                      key={idx}
                      className="flex items-center gap-3 p-2 rounded-lg border cursor-pointer hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={suggestion.selected}
                        onChange={() => {
                          const updated = [...aiSuggestions];
                          updated[idx] = { ...updated[idx], selected: !updated[idx].selected };
                          setAiSuggestions(updated);
                        }}
                        className="rounded"
                      />
                      <span className={suggestion.selected ? "" : "text-muted-foreground line-through"}>
                        {suggestion.title}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveSelectedTopics}>
                    Save Selected ({aiSuggestions.filter((s) => s.selected).length})
                  </Button>
                  <Button variant="outline" onClick={() => setAiSuggestions([])}>
                    Discard
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Category (optional)</Label>
            <Input
              placeholder="e.g., Technology, Health, AI..."
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              list="add-categories"
            />
            <datalist id="add-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
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

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={filterCategory === "all" ? "default" : "outline"}
            onClick={() => setFilterCategory("all")}
          >
            All ({topics.length})
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={filterCategory === cat ? "default" : "outline"}
              onClick={() => setFilterCategory(cat)}
            >
              {cat} ({topics.filter((t) => t.category === cat).length})
            </Button>
          ))}
          <Button
            size="sm"
            variant={filterCategory === "uncategorized" ? "default" : "outline"}
            onClick={() => setFilterCategory("uncategorized")}
          >
            Uncategorized ({topics.filter((t) => !t.category).length})
          </Button>
        </div>
      )}

      {/* Topic List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Topics</CardTitle>
          <CardDescription>
            {filteredTopics.length} topics{filterCategory !== "all" ? ` in "${filterCategory}"` : " total"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : filteredTopics.length === 0 ? (
            <p className="text-muted-foreground">No topics yet. Add some above!</p>
          ) : (
            <div className="space-y-2">
              {filteredTopics.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/topics/${topic.id}`)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`truncate ${topic.used ? "text-muted-foreground line-through" : ""}`}>
                      {topic.title}
                    </span>
                    {topic.category && (
                      <Badge variant="secondary" className="shrink-0">
                        {topic.category}
                      </Badge>
                    )}
                    {topic.used && <Badge variant="secondary" className="shrink-0">Used</Badge>}
                  </div>
                  <div className="flex gap-2 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleUsed(topic.id, topic.used)}
                    >
                      {topic.used ? "Unused" : "Used"}
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
