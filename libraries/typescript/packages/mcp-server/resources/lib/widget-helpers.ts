/** Two-letter style initials for avatar fallback (no images). */
export function initialsFromLabel(
  name: string | undefined | null,
  maxChars = 2
): string {
  const t = name?.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, maxChars).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function deploymentPrimaryUrl(d: {
  domain?: string;
  customDomain?: string;
}): string | undefined {
  const host = d.customDomain?.trim() || d.domain?.trim();
  if (!host) return undefined;
  if (host.startsWith("http://") || host.startsWith("https://")) {
    return host;
  }
  return `https://${host}`;
}

export type StatusBadgeKind = "success" | "destructive" | "warning" | "muted";

export function statusBadgeKind(status: string | undefined): StatusBadgeKind {
  const s = (status ?? "").toLowerCase();
  if (
    s.includes("fail") ||
    s.includes("error") ||
    s === "failed" ||
    s === "error"
  ) {
    return "destructive";
  }
  if (
    s.includes("run") ||
    s.includes("success") ||
    s.includes("ready") ||
    s.includes("active") ||
    s === "running"
  ) {
    return "success";
  }
  if (s.includes("pend") || s.includes("build") || s.includes("deploy")) {
    return "warning";
  }
  if (s.includes("stop") || s.includes("pause")) {
    return "muted";
  }
  return "muted";
}

export function formatIsoDate(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const d = Date.parse(iso);
  if (Number.isNaN(d)) return iso;
  return new Date(d).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
