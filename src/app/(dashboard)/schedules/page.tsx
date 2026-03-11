"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import type { ScheduleRecord } from "@/types";

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newFrequency, setNewFrequency] = useState("DAILY");
  const [newTopicSource, setNewTopicSource] = useState("FROM_LIST");

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/schedules");
      if (res.ok) setSchedules(await res.json());
    } catch (error) {
      console.error("Failed to fetch schedules:", error);
    }
  }, []);

  useEffect(() => {
    fetchSchedules().finally(() => setLoading(false));
  }, [fetchSchedules]);

  async function createSchedule() {
    await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        frequency: newFrequency,
        topicSource: newTopicSource,
      }),
    });
    fetchSchedules();
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/schedules/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    fetchSchedules();
  }

  async function deleteSchedule(id: string) {
    if (!confirm("Delete this schedule?")) return;
    await fetch(`/api/schedules/${id}`, { method: "DELETE" });
    fetchSchedules();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Schedules</h1>
        <p className="text-muted-foreground">Automate video creation on a schedule</p>
      </div>

      {/* Create Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Create Schedule</CardTitle>
          <CardDescription>Set up automatic video generation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Frequency</label>
              <Select value={newFrequency} onChange={(e) => setNewFrequency(e.target.value)}>
                <option value="HOURLY">Every Hour</option>
                <option value="DAILY">Every Day</option>
                <option value="WEEKLY">Every Week</option>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Topic Source</label>
              <Select value={newTopicSource} onChange={(e) => setNewTopicSource(e.target.value)}>
                <option value="FROM_LIST">From Topic List</option>
                <option value="AI_GENERATED">AI Generated</option>
              </Select>
            </div>
          </div>
          <Button onClick={createSchedule}>Create Schedule</Button>
        </CardContent>
      </Card>

      {/* Schedule List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Schedules</CardTitle>
          <CardDescription>{schedules.length} schedules configured</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : schedules.length === 0 ? (
            <p className="text-muted-foreground">No schedules yet. Create one above!</p>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{schedule.frequency}</span>
                      <Badge variant={schedule.active ? "success" : "secondary"}>
                        {schedule.active ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Source: {schedule.topicSource === "FROM_LIST" ? "Topic List" : "AI Generated"}
                    </p>
                    {schedule.nextRunAt && (
                      <p className="text-sm text-muted-foreground">
                        Next run: {new Date(schedule.nextRunAt).toLocaleString()}
                      </p>
                    )}
                    {schedule.lastRunAt && (
                      <p className="text-sm text-muted-foreground">
                        Last run: {new Date(schedule.lastRunAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={schedule.active}
                      onCheckedChange={() => toggleActive(schedule.id, schedule.active)}
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteSchedule(schedule.id)}
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
