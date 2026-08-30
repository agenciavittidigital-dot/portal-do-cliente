export type EditorialPlatform =
  | "instagram" | "facebook" | "linkedin" | "tiktok" | "youtube";

export const EDITORIAL_PLATFORMS: readonly { key: EditorialPlatform; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook",  label: "Facebook"  },
  { key: "linkedin",  label: "LinkedIn"  },
  { key: "tiktok",    label: "TikTok"    },
  { key: "youtube",   label: "YouTube"   },
];

export function isValidEditorialPlatform(v: unknown): v is EditorialPlatform {
  return typeof v === "string" && EDITORIAL_PLATFORMS.some((p) => p.key === v);
}

export function getPlatformLabel(key: string): string {
  return EDITORIAL_PLATFORMS.find((p) => p.key === key)?.label ?? key;
}
