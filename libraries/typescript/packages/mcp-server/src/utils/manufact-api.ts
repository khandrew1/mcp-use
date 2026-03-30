const DEFAULT_MANUFACT_API_BASE = "https://cloud.mcp-use.com/api/v1";
const DEFAULT_MANUFACT_API_TIMEOUT_MS = 30_000;
const DEFAULT_MANUFACT_LOG_TIMEOUT_MS = 60_000;

export interface ManufactRequestOptions {
  profileId?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface RequestManufactApiOptions extends ManufactRequestOptions {
  accessToken: string;
  path: string;
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  fetch?: typeof globalThis.fetch;
}

export interface ManufactOrganization {
  id: string;
  profile_name: string;
  slug: string | null;
  role?: string | null;
}

export interface ManufactDeploymentSource {
  type?: string;
  repo?: string;
  branch?: string;
  rootDir?: string;
  startCommand?: string;
  runtime?: string;
  port?: number;
  env?: Record<string, string>;
  buildCommand?: string;
  baseImage?: string;
}

export interface ManufactCreateDeploymentGithubSource {
  type: "github";
  repo: string;
  branch?: string;
  rootDir?: string;
  startCommand?: string;
  runtime?: "node" | "python";
  port?: number;
  env?: Record<string, string>;
  buildCommand?: string;
}

export interface ManufactCreateDeploymentRequest {
  name: string;
  source: ManufactCreateDeploymentGithubSource;
  healthCheckPath?: string;
  serverId?: string;
}

export interface ManufactDeployment {
  id: string;
  name?: string;
  userId?: string;
  source?: ManufactDeploymentSource;
  domain?: string;
  customDomain?: string;
  port?: number;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  healthCheckPath?: string;
  provider?: string;
  appName?: string;
  error?: string;
  buildLogs?: string;
  buildStartedAt?: string;
  buildCompletedAt?: string;
  gitCommitSha?: string;
  gitBranch?: string;
  gitCommitMessage?: string;
  serverId?: string;
  serverSlug?: string;
}

export interface ManufactDeploymentListResponse {
  deployments: ManufactDeployment[];
  total?: number;
}

export interface ManufactDeploymentLogsResponse {
  logs?: string;
  data?: Record<string, unknown> & {
    logs?: string;
  };
}

export class ManufactApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string,
    public readonly parsedBody?: unknown,
    public readonly retryAfter?: string | null
  ) {
    super(message);
    this.name = "ManufactApiError";
  }
}

function getManufactApiBaseUrl(): string {
  const raw =
    process.env.MANUFACT_CLOUD_API_BASE_URL?.trim() ||
    DEFAULT_MANUFACT_API_BASE;

  return raw.replace(/\/+$/, "");
}

function parseResponseBody(rawText: string): unknown {
  if (!rawText) return null;

  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
}

function getErrorMessage(parsedBody: unknown, status: number): string {
  if (
    typeof parsedBody === "object" &&
    parsedBody !== null &&
    "message" in parsedBody &&
    typeof (parsedBody as { message?: unknown }).message === "string"
  ) {
    return (parsedBody as { message: string }).message;
  }

  if (typeof parsedBody === "string" && parsedBody.trim()) {
    return parsedBody;
  }

  return `Manufact Cloud API request failed (HTTP ${status})`;
}

function normalizeDeploymentListResponse(
  response: unknown
): ManufactDeploymentListResponse {
  if (Array.isArray(response)) {
    return { deployments: response as ManufactDeployment[], total: response.length };
  }

  if (
    typeof response === "object" &&
    response !== null &&
    "deployments" in response &&
    Array.isArray((response as { deployments?: unknown }).deployments)
  ) {
    return response as ManufactDeploymentListResponse;
  }

  return { deployments: [] };
}

function normalizeDeploymentLogsResponse(
  response: unknown
): ManufactDeploymentLogsResponse {
  if (typeof response === "string") {
    return { logs: response };
  }

  if (typeof response === "object" && response !== null) {
    const record = response as ManufactDeploymentLogsResponse;
    if (!record.logs && record.data?.logs) {
      return {
        ...record,
        logs: record.data.logs,
      };
    }

    return record;
  }

  return {};
}

export async function requestManufactApi<T>({
  accessToken,
  path,
  method = "GET",
  profileId,
  body,
  timeoutMs = DEFAULT_MANUFACT_API_TIMEOUT_MS,
  signal,
  fetch: fetchImpl = globalThis.fetch,
}: RequestManufactApiOptions): Promise<T> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  const requestSignal =
    signal && typeof AbortSignal.any === "function"
      ? AbortSignal.any([signal, timeoutController.signal])
      : (signal ?? timeoutController.signal);

  try {
    const response = await fetchImpl(`${getManufactApiBaseUrl()}${path}`, {
      method,
      signal: requestSignal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(profileId ? { "x-profile-id": profileId } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const rawText = await response.text();
    const parsedBody = parseResponseBody(rawText);

    if (!response.ok) {
      throw new ManufactApiError(
        getErrorMessage(parsedBody, response.status),
        response.status,
        rawText,
        parsedBody,
        response.headers.get("Retry-After")
      );
    }

    return parsedBody as T;
  } catch (error) {
    if (error instanceof ManufactApiError) {
      throw error;
    }

    if (
      error instanceof Error &&
      error.name === "AbortError" &&
      !timeoutController.signal.aborted
    ) {
      throw error;
    }

    if (
      error instanceof Error &&
      error.name === "AbortError" &&
      timeoutController.signal.aborted
    ) {
      throw new Error(`Request timeout after ${timeoutMs / 1000}s.`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function listOrganizations(
  accessToken: string,
  options: ManufactRequestOptions = {}
): Promise<ManufactOrganization[]> {
  return requestManufactApi<ManufactOrganization[]>({
    accessToken,
    path: "/profiles",
    ...options,
  });
}

export async function getOrganization(
  accessToken: string,
  profileId: string,
  options: Omit<ManufactRequestOptions, "profileId"> = {}
): Promise<ManufactOrganization> {
  return requestManufactApi<ManufactOrganization>({
    accessToken,
    path: `/profiles/${profileId}`,
    ...options,
  });
}

export async function listDeployments(
  accessToken: string,
  options: ManufactRequestOptions = {}
): Promise<ManufactDeploymentListResponse> {
  const response = await requestManufactApi<unknown>({
    accessToken,
    path: "/deployments",
    ...options,
  });

  return normalizeDeploymentListResponse(response);
}

export async function getDeployment(
  accessToken: string,
  deploymentId: string,
  options: ManufactRequestOptions = {}
): Promise<ManufactDeployment> {
  return requestManufactApi<ManufactDeployment>({
    accessToken,
    path: `/deployments/${deploymentId}`,
    ...options,
  });
}

export async function createDeployment(
  accessToken: string,
  request: ManufactCreateDeploymentRequest,
  options: ManufactRequestOptions = {}
): Promise<ManufactDeployment> {
  return requestManufactApi<ManufactDeployment>({
    accessToken,
    path: "/deployments",
    method: "POST",
    body: request,
    ...options,
  });
}

export async function redeployDeployment(
  accessToken: string,
  deploymentId: string,
  options: ManufactRequestOptions = {}
): Promise<ManufactDeployment> {
  return requestManufactApi<ManufactDeployment>({
    accessToken,
    path: `/deployments/${deploymentId}/redeploy`,
    method: "POST",
    ...options,
  });
}

export async function getDeploymentLogs(
  accessToken: string,
  deploymentId: string,
  options: ManufactRequestOptions = {}
): Promise<ManufactDeploymentLogsResponse> {
  const response = await requestManufactApi<unknown>({
    accessToken,
    path: `/deployments/${deploymentId}/logs`,
    timeoutMs: options.timeoutMs ?? DEFAULT_MANUFACT_LOG_TIMEOUT_MS,
    ...options,
  });

  return normalizeDeploymentLogsResponse(response);
}

export async function getDeploymentBuildLogs(
  accessToken: string,
  deploymentId: string,
  options: ManufactRequestOptions = {}
): Promise<ManufactDeploymentLogsResponse> {
  const response = await requestManufactApi<unknown>({
    accessToken,
    path: `/deployments/${deploymentId}/logs/build`,
    timeoutMs: options.timeoutMs ?? DEFAULT_MANUFACT_LOG_TIMEOUT_MS,
    ...options,
  });

  return normalizeDeploymentLogsResponse(response);
}

export async function stopDeployment(
  accessToken: string,
  deploymentId: string,
  options: ManufactRequestOptions = {}
): Promise<ManufactDeployment> {
  return requestManufactApi<ManufactDeployment>({
    accessToken,
    path: `/deployments/${deploymentId}`,
    method: "PATCH",
    body: { status: "stopped" },
    ...options,
  });
}

export async function startDeployment(
  accessToken: string,
  deploymentId: string,
  options: ManufactRequestOptions = {}
): Promise<ManufactDeployment> {
  return requestManufactApi<ManufactDeployment>({
    accessToken,
    path: `/deployments/${deploymentId}`,
    method: "PATCH",
    body: { status: "running" },
    ...options,
  });
}

export {
  DEFAULT_MANUFACT_API_TIMEOUT_MS,
  DEFAULT_MANUFACT_LOG_TIMEOUT_MS,
};
