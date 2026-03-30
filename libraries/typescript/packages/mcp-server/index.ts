import {
  MCPServer,
  oauthSupabaseProvider,
  error,
  object,
} from "mcp-use/server";
import { z } from "zod";
import { fetchUsersMe, ManufactApiError } from "./src/manufact-api.js";

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

server.tool(
  {
    name: "whoami",
    description:
      "Returns the current user from the Manufact Cloud API (GET /users/me). Use to verify OAuth and upstream API access.",
    schema: z.object({}),
    annotations: { readOnlyHint: true },
  },
  async (_args, ctx) => {
    try {
      const me = await fetchUsersMe(ctx.auth.accessToken);
      return object(
        (typeof me === "object" && me !== null
          ? me
          : { value: me }) as Record<string, unknown>
      );
    } catch (e) {
      if (e instanceof ManufactApiError) {
        return error(`${e.message} (HTTP ${e.status})`);
      }
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
console.log(`Manufact Cloud MCP server listening on port ${PORT}`);
server.listen(PORT);
