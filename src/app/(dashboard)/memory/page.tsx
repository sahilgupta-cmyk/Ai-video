"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MemoryRecord } from "@/types";

const PREDEFINED_KEYS = [
  { key: "writing_style", label: "Writing Style", placeholder: "e.g., Conversational, informative, with a touch of humor..." },
  { key: "intro_template", label: "Intro Template", placeholder: "e.g., Hey everyone, welcome back to the AI Podcast..." },
  { key: "sign_off", label: "Sign Off", placeholder: "e.g., Thanks for watching, and I'll see you in the next one!" },
  { key: "tone", label: "Tone", placeholder: "e.g., Professional but approachable, enthusiastic about technology..." },
  { key: "target_length", label: "Target Length", placeholder: "e.g., 3-5 minutes, around 500 words..." },
];

export default function MemoryPage() {
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [customKey, setCustomKey] = useState("");
  const [customValue, setCustomValue] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const fetchMemories = useCallback(async () => {
    try {
      const res = await fetch("/api/memory");
      if (res.ok) setMemories(await res.json());
    } catch (error) {
      console.error("Failed to fetch:", error);
    }
  }, []);

  useEffect(() => {
    fetchMemories().finally(() => setLoading(false));
  }, [fetchMemories]);

  async function saveMemory(key: string, value: string) {
    setSaving(key);
    await fetch("/api/memory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    await fetchMemories();
    setSaving(null);
  }

  async function deleteMemory(key: string) {
    await fetch(`/api/memory?key=${encodeURIComponent(key)}`, { method: "DELETE" });
    fetchMemories();
  }

  async function addCustomMemory() {
    if (!customKey.trim() || !customValue.trim()) return;
    await saveMemory(customKey.trim(), customValue.trim());
    setCustomKey("");
    setCustomValue("");
  }

  function getMemoryValue(key: string): string {
    return memories.find((m) => m.key === key)?.value || "";
  }

  if (loading) return <p className="text-muted-foreground p-6">Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Project Memory</h1>
        <p className="text-muted-foreground">
          Define writing style and instructions that influence how your scripts are generated
        </p>
      </div>

      {/* Predefined Keys */}
      <Card>
        <CardHeader>
          <CardTitle>Writing Instructions</CardTitle>
          <CardDescription>These settings are automatically applied to all generated scripts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {PREDEFINED_KEYS.map((item) => {
            const currentValue = getMemoryValue(item.key);
            return (
              <PredefinedMemoryField
                key={item.key}
                label={item.label}
                placeholder={item.placeholder}
                value={currentValue}
                saving={saving === item.key}
                onSave={(value) => saveMemory(item.key, value)}
                onDelete={() => deleteMemory(item.key)}
              />
            );
          })}
        </CardContent>
      </Card>

      {/* Custom Keys */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Instructions</CardTitle>
          <CardDescription>Add any additional instructions for script generation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {memories
            .filter((m) => !PREDEFINED_KEYS.some((p) => p.key === m.key))
            .map((memory) => (
              <div key={memory.id} className="flex items-start gap-3 p-3 rounded-lg border">
                <div className="flex-1">
                  <p className="font-medium text-sm">{memory.key}</p>
                  <p className="text-sm text-muted-foreground mt-1">{memory.value}</p>
                </div>
                <Button size="sm" variant="destructive" onClick={() => deleteMemory(memory.key)}>
                  Delete
                </Button>
              </div>
            ))}

          <div className="border-t pt-4 space-y-3">
            <Input
              placeholder="Key (e.g., brand_guidelines)"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
            />
            <Textarea
              placeholder="Value..."
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              rows={3}
            />
            <Button onClick={addCustomMemory} disabled={!customKey.trim() || !customValue.trim()}>
              Add Custom Instruction
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PredefinedMemoryField({
  label,
  placeholder,
  value,
  saving,
  onSave,
  onDelete,
}: {
  label: string;
  placeholder: string;
  value: string;
  saving: boolean;
  onSave: (value: string) => void;
  onDelete: () => void;
}) {
  const [editValue, setEditValue] = useState(value);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setEditValue(value);
    setDirty(false);
  }, [value]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        {value && (
          <Button size="sm" variant="ghost" onClick={onDelete}>
            Clear
          </Button>
        )}
      </div>
      <Textarea
        placeholder={placeholder}
        value={editValue}
        onChange={(e) => {
          setEditValue(e.target.value);
          setDirty(true);
        }}
        rows={2}
      />
      {dirty && (
        <Button
          size="sm"
          onClick={() => {
            onSave(editValue);
            setDirty(false);
          }}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      )}
    </div>
  );
}
