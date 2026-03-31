import { AppsSDKUIProvider } from "@openai/apps-sdk-ui/components/AppsSDKUIProvider";
import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import {
  McpUseProvider,
  useWidget,
  type WidgetMetadata,
} from "mcp-use/react";
import { Link } from "react-router";
import { organizationPropsSchema } from "../lib/deployment-props";
import type { z } from "zod";
import "../styles.css";

export const widgetMetadata: WidgetMetadata = {
  description: "Organization (profile) summary card",
  props: organizationPropsSchema,
  exposeAsTool: false,
};

type Props = z.infer<typeof organizationPropsSchema>;

function Row({ label, value }: { label: string; value: string | undefined }) {
  if (value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-x-3 gap-y-1 text-sm">
      <span className="text-secondary">{label}</span>
      <span className="min-w-0 break-words font-medium font-mono text-[0.8125rem] text-default">
        {value}
      </span>
    </div>
  );
}

export default function OrganizationCardWidget() {
  const { props, isPending } = useWidget<Props>();

  if (isPending) {
    return (
      <McpUseProvider autoSize>
        <div className="mcp-widget-root text-secondary p-3 text-sm">Loading…</div>
      </McpUseProvider>
    );
  }

  const { organization } = props;
  const title = organization.profile_name ?? "Organization";

  return (
    <McpUseProvider autoSize>
      <div className="mcp-widget-root">
        <AppsSDKUIProvider linkComponent={Link}>
          <div className="relative overflow-hidden rounded-3xl border border-default bg-surface-elevated">
            <div className="border-b border-subtle px-5 pb-4 pt-5">
              <div className="min-w-0 space-y-2">
                <h2 className="heading-md text-default">{title}</h2>
                {organization.role ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color="secondary" size="sm" variant="soft">
                      {organization.role}
                    </Badge>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="space-y-3 px-5 pb-5 pt-4">
              <Row label="Profile ID" value={organization.id} />
              <Row
                label="Slug"
                value={
                  organization.slug === null || organization.slug === undefined
                    ? undefined
                    : organization.slug
                }
              />
            </div>
          </div>
        </AppsSDKUIProvider>
      </div>
    </McpUseProvider>
  );
}
