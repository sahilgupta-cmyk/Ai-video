"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SettingsData {
  claudeApiKey: string;
  elevenLabsApiKey: string;
  heygenApiKey: string;
  heygenAvatarId: string;
  elevenLabsVoiceId: string;
  hasClaudeKey?: boolean;
  hasElevenLabsKey?: boolean;
  hasHeygenKey?: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({
    claudeApiKey: "",
    elevenLabsApiKey: "",
    heygenApiKey: "",
    heygenAvatarId: "",
    elevenLabsVoiceId: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setMessage("Settings saved successfully!");
        // Refresh to get masked keys
        const refreshed = await fetch("/api/settings").then((r) => r.json());
        setSettings(refreshed);
      } else {
        setMessage("Failed to save settings");
      }
    } catch {
      setMessage("Something went wrong");
    }
    setSaving(false);
  }

  if (loading) return <p className="text-muted-foreground p-6">Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your API keys and video generation settings</p>
      </div>

      {message && (
        <div className={`p-3 rounded-md text-sm ${
          message.includes("success") ? "bg-green-100 text-green-800" : "bg-destructive/10 text-destructive"
        }`}>
          {message}
        </div>
      )}

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Your API keys are encrypted at rest. Enter a new key to update, or leave as-is to keep the current key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Claude API Key {settings.hasClaudeKey && <span className="text-green-600">(configured)</span>}</Label>
            <Input
              type="password"
              placeholder="sk-ant-..."
              value={settings.claudeApiKey}
              onChange={(e) => setSettings({ ...settings, claudeApiKey: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>ElevenLabs API Key {settings.hasElevenLabsKey && <span className="text-green-600">(configured)</span>}</Label>
            <Input
              type="password"
              placeholder="Enter your ElevenLabs API key"
              value={settings.elevenLabsApiKey}
              onChange={(e) => setSettings({ ...settings, elevenLabsApiKey: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>HeyGen API Key {settings.hasHeygenKey && <span className="text-green-600">(configured)</span>}</Label>
            <Input
              type="password"
              placeholder="Enter your HeyGen API key"
              value={settings.heygenApiKey}
              onChange={(e) => setSettings({ ...settings, heygenApiKey: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Avatar & Voice Config */}
      <Card>
        <CardHeader>
          <CardTitle>Avatar & Voice</CardTitle>
          <CardDescription>Configure your AI avatar and voice clone settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>HeyGen Avatar ID</Label>
            <Input
              placeholder="Enter your HeyGen avatar ID"
              value={settings.heygenAvatarId}
              onChange={(e) => setSettings({ ...settings, heygenAvatarId: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Find this in your HeyGen dashboard under Avatars
            </p>
          </div>
          <div className="space-y-2">
            <Label>ElevenLabs Voice ID</Label>
            <Input
              placeholder="Enter your ElevenLabs voice ID"
              value={settings.elevenLabsVoiceId}
              onChange={(e) => setSettings({ ...settings, elevenLabsVoiceId: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Find this in your ElevenLabs dashboard under Voices
            </p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} size="lg">
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
