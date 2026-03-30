import {
  MCPServer,
  oauthSupabaseProvider,
  error,
  object,
} from "mcp-use/server";
import { z } from "zod";
import {
  getDeployment,
  getDeploymentBuildLogs,
  getDeploymentLogs,
  getOrganization,
  listDeployments,
  listOrganizations,
  ManufactApiError,
  redeployDeployment,
  startDeployment,
  stopDeployment,
} from "./src/utils/index.js";

const skipVerification =
  process.env.MCP_USE_OAUTH_SUPABASE_SKIP_VERIFICATION === "true";

const server = new MCPServer({
  name: "manufact-cloud",
  title: "Manufact Cloud",
  version: "1.0.0",
  description:
    "Manufact Cloud MCP server — OAuth + Manufact Cloud API (testing scaffold).",
  baseUrl: process.env.MCP_URL || "http://localhost:3000",
  favicon: "favicon.ico",
  websiteUrl: "https://mcp-use.com",
  icons: [
    {
      src: "icon.svg",
      mimeType: "image/svg+xml",
      sizes: ["512x512"],
    },
  ],
  oauth: oauthSupabaseProvider({
    jwtSecret: process.env.MCP_USE_OAUTH_SUPABASE_JWT_SECRET,
    skipVerification,
  }),
});

const profileIdSchema = z
  .string()
  .optional()
  .describe(
    "Optional profile ID to scope the request if the upstream API requires it."
  );

function formatManufactApiError(errorValue: unknown): string {
  if (errorValue instanceof ManufactApiError) {
    const retryAfter = errorValue.retryAfter
      ? ` Retry-After: ${errorValue.retryAfter}.`
      : "";
    return `${errorValue.message} (HTTP ${errorValue.status}).${retryAfter}`;
  }

  if (errorValue instanceof Error) {
    return errorValue.message;
  }

  return String(errorValue);
}

server.tool(
  {
    name: "list_organizations",
    description:
      "List organizations the authenticated user can access. Uses the upstream profiles API.",
    schema: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async (_args, ctx) => {
    try {
      const organizations = await listOrganizations(ctx.auth.accessToken);
      return object({ organizations });
    } catch (e) {
      return error(formatManufactApiError(e));
    }
  }
);

server.tool(
  {
    name: "get_organization",
    description:
      "Get one organization by profile ID. Use when you already know the organization to inspect.",
    schema: z.object({
      profileId: z
        .string()
        .describe("The profile ID for the organization to retrieve."),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async ({ profileId }, ctx) => {
    try {
      const organization = await getOrganization(ctx.auth.accessToken, profileId);
      return object({ organization });
    } catch (e) {
      return error(formatManufactApiError(e));
    }
  }
);

server.tool(
  {
    name: "list_deployments",
    description:
      "List deployments visible to the authenticated user. Optionally scope by organization profile ID if needed.",
    schema: z.object({
      profileId: profileIdSchema,
    }),
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async ({ profileId }, ctx) => {
    try {
      const deploymentList = await listDeployments(ctx.auth.accessToken, {
        profileId,
      });
      return object(deploymentList);
    } catch (e) {
      return error(formatManufactApiError(e));
    }
  }
);

server.tool(
  {
    name: "get_deployment",
    description:
      "Get full details for one deployment by deployment ID. Optionally scope by organization profile ID if needed.",
    schema: z.object({
      deploymentId: z
        .string()
        .describe("The deployment ID to retrieve."),
      profileId: profileIdSchema,
    }),
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async ({ deploymentId, profileId }, ctx) => {
    try {
      const deployment = await getDeployment(ctx.auth.accessToken, deploymentId, {
        profileId,
      });
      return object({ deployment });
    } catch (e) {
      return error(formatManufactApiError(e));
    }
  }
);

server.tool(
  {
    name: "redeploy_deployment",
    description:
      "Redeploy a deployment. Requires the deployment ID.",
    schema: z.object({
      deploymentId: z
        .string()
        .describe("The deployment ID to redeploy."),
      profileId: profileIdSchema,
    }),
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  async ({ deploymentId, profileId }, ctx) => {
    try {
      const deployment = await redeployDeployment(
        ctx.auth.accessToken,
        deploymentId,
        {
          profileId,
        }
      );
      return object({ deployment });
    } catch (e) {
      return error(formatManufactApiError(e));
    }
  }
);

server.tool(
  {
    name: "get_deployment_runtime_logs",
    description:
      "Get runtime or platform logs for a deployment. Optionally scope by organization profile ID if needed.",
    schema: z.object({
      deploymentId: z
        .string()
        .describe("The deployment ID whose logs you want."),
      profileId: profileIdSchema,
    }),
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async ({ deploymentId, profileId }, ctx) => {
    try {
      const logs = await getDeploymentLogs(ctx.auth.accessToken, deploymentId, {
        profileId,
      });
      return object(logs);
    } catch (e) {
      return error(formatManufactApiError(e));
    }
  }
);

server.tool(
  {
    name: "get_deployment_build_logs",
    description:
      "Get build logs for a deployment. Optionally scope by organization profile ID if needed.",
    schema: z.object({
      deploymentId: z
        .string()
        .describe("The deployment ID whose build logs you want."),
      profileId: profileIdSchema,
    }),
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async ({ deploymentId, profileId }, ctx) => {
    try {
      const logs = await getDeploymentBuildLogs(
        ctx.auth.accessToken,
        deploymentId,
        {
          profileId,
        }
      );
      return object(logs);
    } catch (e) {
      return error(formatManufactApiError(e));
    }
  }
);

server.tool(
  {
    name: "stop_deployment",
    description:
      "Stop a running deployment. Requires the deployment ID and optionally a profile ID for scoping.",
    schema: z.object({
      deploymentId: z
        .string()
        .describe("The deployment ID to stop."),
      profileId: profileIdSchema,
    }),
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  async ({ deploymentId, profileId }, ctx) => {
    try {
      const deployment = await stopDeployment(ctx.auth.accessToken, deploymentId, {
        profileId,
      });
      return object({ deployment });
    } catch (e) {
      return error(formatManufactApiError(e));
    }
  }
);

server.tool(
  {
    name: "start_deployment",
    description:
      "Start a stopped deployment. Requires the deployment ID and optionally a profile ID for scoping.",
    schema: z.object({
      deploymentId: z
        .string()
        .describe("The deployment ID to start."),
      profileId: profileIdSchema,
    }),
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  async ({ deploymentId, profileId }, ctx) => {
    try {
      const deployment = await startDeployment(ctx.auth.accessToken, deploymentId, {
        profileId,
      });
      return object({ deployment });
    } catch (e) {
      return error(formatManufactApiError(e));
    }
  }
);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
console.log(`Manufact Cloud MCP server listening on port ${PORT}`);
server.listen(PORT);
