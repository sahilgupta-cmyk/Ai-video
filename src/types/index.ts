export type VideoStatus =
  | "PENDING"
  | "GENERATING_SCRIPT"
  | "SCRIPT_READY"
  | "GENERATING_AUDIO"
  | "AUDIO_READY"
  | "GENERATING_VIDEO"
  | "COMPLETED"
  | "FAILED";

export type ScheduleFreq = "HOURLY" | "DAILY" | "WEEKLY" | "CUSTOM";
export type TopicSource = "FROM_LIST" | "AI_GENERATED";

export interface VideoRecord {
  id: string;
  topic: string;
  topicId: string | null;
  script: string | null;
  status: VideoStatus;
  autoApprove: boolean;
  videoUrl: string | null;
  audioUrl: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  contentFormat: string | null;
  targetDuration: number | null;
  videoFormat: string | null;
  voiceStyle: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TopicRecord {
  id: string;
  title: string;
  notes: string | null;
  category: string | null;
  used: boolean;
  createdAt: string;
}

export interface ScheduleRecord {
  id: string;
  frequency: ScheduleFreq;
  cronExpr: string | null;
  active: boolean;
  topicSource: TopicSource;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
}

export interface MemoryRecord {
  id: string;
  key: string;
  value: string;
}

export type ContentFormat = "long_form" | "short_form";
export type VideoFormat = "landscape" | "portrait" | "square";
export type AIProvider = "claude" | "openai";

export interface UserSettings {
  claudeApiKey: string;
  openaiApiKey: string;
  aiProvider: AIProvider;
  elevenLabsApiKey: string;
  heygenApiKey: string;
  heygenAvatarId: string;
  elevenLabsVoiceId: string;
  hasClaudeKey?: boolean;
  hasOpenaiKey?: boolean;
  hasElevenLabsKey?: boolean;
  hasHeygenKey?: boolean;
}
