import { AppsSDKUIProvider } from "@openai/apps-sdk-ui/components/AppsSDKUIProvider";
import {
  Image,
  McpUseProvider,
  useWidget,
  type WidgetMetadata,
} from "mcp-use/react";
import { Link } from "react-router";
import { deploymentDetailPropsSchema } from "../lib/deployment-props";
import {
  deploymentPrimaryUrl,
  formatIsoDate,
  statusBadgeKind,
  type StatusBadgeKind,
} from "../lib/widget-helpers";
import type { z } from "zod";
import "../styles.css";

export const widgetMetadata: WidgetMetadata = {
  description: "Single deployment detail card",
  props: deploymentDetailPropsSchema,
  exposeAsTool: false,
};

type Props = z.infer<typeof deploymentDetailPropsSchema>;

function StatusDot({ status }: { status: string | undefined }) {
  const kind = statusBadgeKind(status);
  const label = status?.trim() || "unknown";
  const colors: Record<StatusBadgeKind, { ring: string; dot: string }> = {
    success:     { ring: "bg-green-400", dot: "bg-green-500" },
    destructive: { ring: "bg-red-400",   dot: "bg-red-500"   },
    warning:     { ring: "bg-amber-400", dot: "bg-amber-400" },
    muted:       { ring: "bg-gray-400",  dot: "bg-gray-400"  },
  };
  const { ring, dot } = colors[kind];
  const pulse = kind === "success" || kind === "warning";
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0" title={label}>
      {pulse && (
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${ring} opacity-60`} />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dot}`} />
    </span>
  );
}

function GitBranchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
    </svg>
  );
}


export default function DeploymentCardWidget() {
  const { props, isPending } = useWidget<Props>();

  if (isPending) {
    return (
      <McpUseProvider autoSize>
        <div className="mcp-widget-root text-secondary p-3 text-sm">Loading…</div>
      </McpUseProvider>
    );
  }

  const d = props.deployment;
  const name = d.name?.trim() || d.appName?.trim() || d.id;
  const branch = d.gitBranch ?? d.source?.branch;
  const commitMsg = d.gitCommitMessage
    ? d.gitCommitMessage.length > 120
      ? `${d.gitCommitMessage.slice(0, 119)}…`
      : d.gitCommitMessage
    : undefined;
  const repo = d.source?.repo;
  const server = d.serverSlug ?? d.serverId;
  const url = server ? `https://${server}.run.mcp-use.com/mcp` : deploymentPrimaryUrl(d);
  const hasGitSection = repo || branch || commitMsg;

  return (
    <McpUseProvider autoSize>
      <div className="mcp-widget-root">
        <AppsSDKUIProvider linkComponent={Link}>
          <div className="relative overflow-hidden rounded-3xl border border-default bg-surface-elevated">
            {/* Header */}
            <div className="border-b border-subtle px-5 pb-4 pt-5">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="heading-md text-default">{name}</h2>
                  <StatusDot status={d.status} />
                </div>
                {url ? (
                  <p className="font-mono text-sm">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-info block break-all underline-offset-4 hover:underline"
                    >
                      {url}
                    </a>
                  </p>
                ) : null}
              </div>
            </div>

            {/* Git section */}
            {hasGitSection ? (
              <div className="space-y-2 border-b border-subtle px-5 py-4">
                {repo && (
                  <div className="flex items-center gap-1.5">
                    <Image
                      src="/Github-light.svg"
                      alt="GitHub"
                      className="h-3.5 w-3.5 shrink-0 dark:hidden"
                    />
                    <Image
                      src="/GitHub-dark.svg"
                      alt="GitHub"
                      className="hidden h-3.5 w-3.5 shrink-0 dark:block"
                    />
                    <a
                      href={`https://github.com/${repo}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-sm text-default underline-offset-4 hover:underline"
                    >
                      {repo}
                    </a>
                  </div>
                )}
                {(branch || commitMsg) && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {branch && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <GitBranchIcon className="h-3.5 w-3.5 shrink-0 text-secondary" />
                        <span className="font-mono text-xs text-secondary">{branch}</span>
                      </div>
                    )}
                    {commitMsg && (
                      <span className="break-words font-mono text-[0.7rem] text-secondary opacity-60">
                        {commitMsg}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            {/* Error */}
            {d.error ? (
              <div className="border-b border-subtle px-5 py-4">
                <p className="text-sm text-danger">{d.error}</p>
              </div>
            ) : null}

            {/* Footer: server · dates */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3">
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5">
                {server && (
                  <>
                    <span className="text-xs text-secondary opacity-40">Server ID</span>
                    <span className="font-mono text-xs text-secondary">{server}</span>
                  </>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {d.updatedAt ? (
                  <>
                    <span className="text-xs text-secondary opacity-40">Last Updated</span>
                    <span className="font-mono text-xs text-secondary">{formatIsoDate(d.updatedAt)}</span>
                  </>
                ) : d.createdAt ? (
                  <>
                    <span className="text-xs text-secondary opacity-40">created</span>
                    <span className="font-mono text-xs text-secondary">{formatIsoDate(d.createdAt)}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </AppsSDKUIProvider>
      </div>
    </McpUseProvider>
  );
}
