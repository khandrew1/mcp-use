# Manufact Cloud MCP Server — Specification

This document defines the **Manufact Cloud MCP Server**: an MCP server that lets an AI agent **inspect and control** [Manufact](https://manufact.com) cloud resources (MCP server hosting) in a workflow similar to the **Vercel MCP Server**—discover scope (profiles), then list and operate on deployments with clear IDs, logs, and lifecycle actions. **Irreversible destructive actions (e.g. deleting a deployment) are intentionally out of scope for MCP** (§5, §9.2).

**Status:** Core HTTP routes for profiles + deployments are **locked** to `https://cloud.mcp-use.com/api/v1` (§9). Create-deployment and other routes remain TBD where not listed.

---

## 1. Goals


| Goal                            | Detail                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Parity with dashboard + CLI** | Core inspect/operate flows match the dashboard and CLI; **not** every CLI command is exposed as a tool—see **non-goals** (e.g. deployment deletion).               |
| **Agent-friendly ergonomics**   | Tools return structured data; IDs are explicit; list/discover tools exist before mutate tools (e.g. `list_organizations` → `list_deployments` / `get_deployment`). |
| **Secure multi-tenant use**     | OAuth identity is mandatory; operations are always scoped to organizations the user belongs to.                                                                    |
| **Observable**                  | Deployment logs (and, where applicable, build vs runtime) are first-class with pagination and time filters.                                                        |


---

## 2. Architecture (high level)

```
┌─────────────┐     MCP      ┌──────────────────────┐    HTTPS     ┌─────────────────┐
│ MCP client  │ ◄──────────► │ Manufact Cloud MCP   │ ◄──────────► │ Manufact Cloud  │
│ (e.g. Cursor)│   tools/     │ Server (mcp-use app) │  Manufact    │ API               │
│              │   resources  │                      │ credential    │                   │
└─────────────┘              └──────────────────────┘              └─────────────────┘
```

- **Framework:** `mcp-use` server (TypeScript), same stack as this repo.
- **Auth:** **Supabase OAuth** via mcp-use’s built-in OAuth support. MCP clients authenticate to this server with OAuth bearer tokens; tool callbacks receive authenticated user context. The server then calls Manufact Cloud using whatever upstream credential model the Cloud API requires (same token, exchanged token, or API key).
- **API layer:** A small **fetch**-based module (no extra HTTP library required) wraps Manufact Cloud REST API

---

## 3. Authentication & authorization

### 3.1 Supabase OAuth (mcp-use)

- Configure Supabase as the OAuth provider via mcp-use's built-in OAuth support, using the included Supabase adapter in the server config.
- Default to **proxy mode** unless there is a concrete reason to require direct mode.
- At a high level, the server is configured like:

```ts
import { MCPServer, oauthSupabaseProvider } from "mcp-use/server";

const server = new MCPServer({
  name: "manufact-cloud",
  version: "1.0.0",
  oauth: oauthSupabaseProvider({
    // values provided via .env
  }),
});
```

- Environment variables (placeholders—user will wire later):
  - Supabase URL, anon key, JWT secret or JWKS as required by mcp-use (given in .env).
  - Manufact API base URL — production: `https://cloud.mcp-use.com/api/v1` (see §9).
  - Any Manufact-specific client IDs or token exchange secrets if the Cloud API requires a Manufact-issued token derived from Supabase identity.

When OAuth is configured, mcp-use automatically exposes the standard server auth endpoints:

- `GET /authorize`
- `POST /token`
- `GET /.well-known/oauth-authorization-server`
- `GET /.well-known/openid-configuration`

All `**/mcp/*`** endpoints require a valid bearer token when OAuth is enabled.

### 3.2 MCP tool context (`context.auth`)

Once Supabase OAuth is configured, **every tool callback** receives authenticated user info on the **context** object (mcp-use: `context.auth`). The Manufact MCP server uses this for auditing, optional RBAC, resolving organization scope, and attaching the correct credential to upstream API calls.

Standard fields (see [User Context](https://mcp-use.com/docs) / mcp-use TypeScript docs):


| Field                                                  | Use in Manufact MCP                                                                                                                                                                             |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `**userId`** *(required)*                              | Stable user id (`sub`); pass to Manufact if the API expects an actor id for audit logs.                                                                                                         |
| `**email*`*, `**name**`, `**username**`, `**picture**` | Display / support; optional in API calls.                                                                                                                                                       |
| `**roles**`, `**permissions**`                         | Optional gate before calling mutating endpoints if Manufact maps these claims.                                                                                                                  |
| `**scopes**`                                           | Verify OAuth scopes before relying on `email` or other sensitive fields.                                                                                                                        |
| **Provider-specific / custom claims**                  | If Manufact or Supabase embeds org membership or API audience in the JWT, extract via OAuth `getUserInfo` (same pattern as Auth0 example in mcp-use docs) so tools can avoid extra round-trips. |


### 3.3 Identity → Manufact Cloud API

- Distinguish two layers of authentication clearly:
  - **Client → MCP server:** mcp-use OAuth bearer token authentication. This is what protects `/mcp/*` and populates `**context.auth**`.
  - **MCP server → Manufact Cloud API:** the upstream credential the Cloud API accepts.
- Every tool runs with `**context.auth`** populated after OAuth; unauthenticated requests must not call Manufact APIs.
- Each `**fetch**` to Manufact must include credentials the Manufact API accepts, for example:
  - `**Authorization: Bearer <token>**` if the Cloud API accepts the Supabase or exchanged access token directly, or
  - A **Manufact API key or exchanged token** derived from the authenticated session if the Cloud API does not accept the MCP bearer token directly.
- The spec must not assume these two credentials are identical. That remains an implementation decision until the Cloud API contract is confirmed.
- **Authorization:** Regardless of credential form, the MCP server must only expose profiles and deployments that the authenticated user is authorized to access.

### 3.4 Profiles (organizations) and deployments

- In the HTTP API, **profiles** (`GET /profiles`, `GET /profiles/<profile_id>`) correspond to org/workspace scope; MCP tools keep the names `**list_organizations`** / `**get_organization**` for agent ergonomics but pass `**profile_id**` where the URL requires it.
- The MCP auth layer should surface enough authenticated identity in `**context.auth**` to support org-aware tool behavior, but the upstream org selection mechanism still needs to be defined explicitly for deployment tools.
- **Projects** are not separate resources in this API slice—project context is represented **on deployment records** and via `**list_deployments`**; there are no dedicated project list/get endpoints (§4.2).

---

## 4. Tools — catalog

Naming follows **snake_case** MCP tool names; descriptions should mirror Vercel-style clarity (“use when…”, “requires…”).

### 4.1 Organizations (API: profiles)


| Tool                     | Purpose                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `**list_organizations`** | List profiles/orgs the current user can access (`GET /profiles`). **Required** when the user has multiple profiles. |
| `**get_organization`**   | Metadata for one profile (`GET /profiles/<profile_id>`). Tool parameter: `**profile_id**`.                          |


### 4.2 Deployments (CLI parity)

Map directly from:

`mcp-use deployments list | get | restart | logs | stop | start` — `**delete**` is CLI/dashboard only, not an MCP tool.


| Tool                            | Maps to CLI           | Behavior                                                                                                                                          |
| ------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `**list_deployments**`          | `list`, `ls`          | `GET /deployments` — list visible deployments (scope via auth); optional query filters if the API supports them (status, time range, pagination). |
| `**get_deployment**`            | `get <deployment-id>` | `GET /deployments/<deployment_id>` — full detail including project-related fields on the record.                                                  |
| `**restart_deployment**`        | `restart`             | `POST /deployments/<deployment_id>/redeploy`.                                                                                                     |
| `**get_deployment_logs**`       | `logs`                | `GET /deployments/<deployment_id>/logs` — runtime/platform logs (see §6).                                                                         |
| `**get_deployment_build_logs**` | **MCP Specific**      | `GET /deployments/<deployment_id>/logs/build`.                                                                                                    |
| `**stop_deployment`**           | `stop`                | `PATCH /deployments/<deployment_id>` with body `{ "status": "stopped" }`.                                                                         |
| `**start_deployment**`          | `start`               | `PATCH /deployments/<deployment_id>` with body `{ "status": "running" }`.                                                                         |


### 4.3 Deploy / create (dashboard parity)

CLI help excerpt did not include **create deploy**, but agents often need it:


| Tool                                                | Purpose             |
| --------------------------------------------------- | ------------------- |
| `**create_deployment*`* *(or `trigger_deployment`)* | `POST /deployments` |


---

## 5. Safety & mutating operations

- Mutating tools that remain (`**restart_deployment**`, `**stop_deployment**`, `**start_deployment**`, `**create_deployment**`, etc.) should use **explicit IDs** in schemas where applicable; consider **annotations** per mcp-use `tools.md` where appropriate.
- Any future **domain**, **billing**, or other sensitive mutation should require explicit identifiers; optionally `**dryRun`** if the API supports it—otherwise the agent should confirm with the user before calling.
- Return **clear errors** from Manufact API (status, message, retry hints) without leaking secrets.

---

## 6. Log semantics (`get_deployment_logs` / `get_deployment_build_logs`)

- **Paths:** `GET /deployments/<deployment_id>/logs` and `GET /deployments/<deployment_id>/logs/build` (§9).
- **Parameters:** `deployment_id` required; add `**since`**, `**until**`, `**limit**`, `**cursor**` / `**nextPageToken**` if the API documents query params.
- **Search:** optional `query` if supported server-side.
- **Streaming:** SSE/WebSocket tail can be a later iteration; v1 is **pull-based** only unless the API specifies otherwise.

---

## 7. Resources & prompts (optional)

Following mcp-use patterns (`concepts.md`):

- **Resources:** e.g. read-only `manufact://docs/quickstart` or org-scoped `manufact://org/{id}/overview` if useful for grounding—**optional** for v1.
- **Prompts:** Optional templates like “debug failing deployment”, “compare last two deployments”—nice-to-have after core tools work.

---

## 8. Comparison to Vercel MCP Server (behavioral)


| Vercel pattern                  | Manufact analogue                                           |
| ------------------------------- | ----------------------------------------------------------- |
| `list_teams`                    | `list_organizations` (API: `**GET /profiles`**)             |
| `list_projects`                 | *(no separate tool — project fields on deployment records)* |
| `list_deployments`              | `list_deployments` (`GET /deployments`)                     |
| `get_deployment`                | `get_deployment`                                            |
| `get_runtime_logs` / build logs | `get_deployment_logs` / `get_deployment_build_logs`         |
| `deploy_to_vercel`              | `create_deployment` *(route TBD)*                           |
| Doc search                      | `search_documentation` (optional)                           |


---

## 9. Tool → Manufact Cloud HTTP API

The `**mcp-use` CLI** and this **MCP server** call the same **Manufact Cloud API**.

**Base URL:** `https://cloud.mcp-use.com/api/v1`

Paths below are **relative** to that base (e.g. full URL for profiles list: `https://cloud.mcp-use.com/api/v1/profiles`).

**Auth:** This section describes the **Manufact Cloud API** contract, not the MCP server's own OAuth endpoints. The MCP server itself uses mcp-use OAuth bearer-token auth (`§3.1`-`§3.3`). For upstream Cloud API calls, the server must send the credential form the Cloud API accepts.

### 9.1 Profiles (MCP: organizations)

The API uses the resource name **profiles**; MCP tools keep the names `list_organizations` / `get_organization`.


| MCP tool                 | HTTP  | Path                     |
| ------------------------ | ----- | ------------------------ |
| `**list_organizations*`* | `GET` | `/profiles`              |
| `**get_organization**`   | `GET` | `/profiles/<profile_id>` |


### 9.2 Deployments

No `{organization_id}` or `{profile_id}` prefix in these paths. Optional list filters (query string) depend on API docs. The spec still needs to define whether organization scoping is inferred from the upstream credential, sent via a header such as `x-profile-id`, or passed some other way.


| MCP tool                        | HTTP    | Path                                      | Body / notes                                         |
| ------------------------------- | ------- | ----------------------------------------- | ---------------------------------------------------- |
| `**list_deployments`**          | `GET`   | `/deployments`                            | —                                                    |
| `**get_deployment**`            | `GET`   | `/deployments/<deployment_id>`            | —                                                    |
| `**restart_deployment**`        | `POST`  | `/deployments/<deployment_id>/redeploy`   | —                                                    |
| `**get_deployment_logs**`       | `GET`   | `/deployments/<deployment_id>/logs`       | Query params per API (time range, pagination, etc.). |
| `**get_deployment_build_logs**` | `GET`   | `/deployments/<deployment_id>/logs/build` | —                                                    |
| `**stop_deployment**`           | `PATCH` | `/deployments/<deployment_id>`            | `{ "status": "stopped" }`                            |
| `**start_deployment**`          | `PATCH` | `/deployments/<deployment_id>`            | `{ "status": "running" }`                            |


**Intentionally omitted:** `DELETE /deployments/<deployment_id>` — supported by the API for **CLI / dashboard** (`mcp-use deployments delete`); **no** `delete_deployment` MCP tool (non-goals).

### 9.3 Not yet mapped (CLI / dashboard)


| MCP tool               | Notes         |
| ---------------------- | ------------- |
| `**create_deployment**` | Endpoint TBD. |


### 9.4 Source of truth

1. This section + `**https://cloud.mcp-use.com/api/v1**` behavior.
2. `**mcp-use` CLI** — same paths where the MCP exposes the same operation; CLI-only commands (e.g. delete) are not duplicated as tools.
3. Extend **§9.3** when additional v2+ routes are fixed.

---

## 10. Implementation checklist (for developers)

- Scaffold or extend mcp-use app; configure **Supabase OAuth**.
- Implement a **fetch**-based API helper (typed errors; optional retries for 429/5xx) — no separate HTTP library required unless you want one.
- Implement tools in §4 with Zod (or equivalent) input schemas; **annotate** mutating tools per mcp-use `tools.md` (no deployment-delete tool).
- Map each tool to the endpoints in **§9** (verify against CLI + API).
- Integration tests against **staging** Manufact API (mock or sandbox).
- Document required env vars in README (not in this spec unless requested).

---

## 11. Open questions

1. **List/query params:** Supported query parameters for `GET /deployments` and `GET /deployments/.../logs` (pagination, filters).
2. **Upstream credential model:** Confirm whether Manufact Cloud accepts the same bearer token issued via mcp-use Supabase OAuth, requires token exchange, or requires an API key.
3. **Org scoping for deployment calls:** Confirm whether deployment requests are scoped purely by credential or also require an explicit org/profile selector such as a header.
4. **Create deployment:** `POST` route and body for triggering a new deployment.
5. **Rate limits:** Document limits and surface `Retry-After` to the agent in tool responses.

---

## 12. Revision history


| Version | Date       | Notes                                                                                                                                     |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1     | 2026-03-30 | Initial SPEC from CLI + Vercel MCP patterns + org requirement                                                                             |
| 0.2     | 2026-03-30 | `context.auth`; tool → HTTP API mapping (§9); section renumber                                                                            |
| 0.3     | 2026-03-30 | Canonical base `https://cloud.mcp-use.com/api/v1`; `/profiles`, `/deployments` routes; PATCH stop/start; projects folded into deployments |
| 0.4     | 2026-03-30 | Omit `delete_deployment` from MCP; API DELETE remains CLI/dashboard only                                                                  |
| 0.5     | 2026-03-30 | Remove deployment environment variable management from v1 scope                                                                            |
| 0.6     | 2026-03-30 | Clarify mcp-use OAuth server auth vs Manufact upstream auth; document built-in OAuth endpoints and bearer-token protection                 |
