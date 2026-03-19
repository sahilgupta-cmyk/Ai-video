export const SHORT_FORM_DURATIONS = [
  { label: "15 seconds", value: 15, words: 40 },
  { label: "30 seconds", value: 30, words: 80 },
  { label: "60 seconds", value: 60, words: 160 },
  { label: "90 seconds", value: 90, words: 240 },
] as const;

export const LONG_FORM_DURATIONS = [
  { label: "2 minutes", value: 120, words: 300 },
  { label: "3 minutes", value: 180, words: 450 },
  { label: "5 minutes", value: 300, words: 750 },
  { label: "10 minutes", value: 600, words: 1500 },
] as const;

export const VIDEO_DIMENSIONS = {
  landscape: { width: 1920, height: 1080, label: "Landscape (16:9)" },
  portrait: { width: 1080, height: 1920, label: "Portrait (9:16)" },
  square: { width: 1080, height: 1080, label: "Square (1:1)" },
} as const;

export const VOICE_STYLES = {
  short_form: "energetic",
  long_form: "conversational",
} as const;

export const VOICE_STYLE_OPTIONS = [
  { value: "", label: "Default" },
  { value: "energetic", label: "Energetic & Fast-paced" },
  { value: "conversational", label: "Conversational & Warm" },
  { value: "calm", label: "Calm & Measured" },
  { value: "dramatic", label: "Dramatic & Intense" },
] as const;

export function getTargetWords(
  contentFormat: string | null,
  targetDuration: number | null
): number | null {
  if (!contentFormat || !targetDuration) return null;
  const durations =
    contentFormat === "short_form" ? SHORT_FORM_DURATIONS : LONG_FORM_DURATIONS;
  const match = durations.find((d) => d.value === targetDuration);
  return match?.words ?? null;
}
