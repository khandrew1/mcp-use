/**
 * Manufact Cloud API client (fetch-based).
 * Base URL defaults to production; override with MANUFACT_CLOUD_API_BASE_URL.
 */

const DEFAULT_MANUFACT_API_BASE = "https://cloud.mcp-use.com/api/v1";

export class ManufactApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string
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

/**
 * GET /users/me — current user for the authenticated Manufact Cloud session.
 *
 * @param accessToken - OAuth access token (same bearer the Manufact API accepts for the user).
 */
export async function fetchUsersMe(accessToken: string): Promise<unknown> {
  const url = `${getManufactApiBaseUrl()}/users/me`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const rawText = await res.text();
  let parsed: unknown;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new ManufactApiError(
      `Manufact Cloud returned non-JSON (HTTP ${res.status})`,
      res.status,
      rawText
    );
  }

  if (!res.ok) {
    const message =
      typeof parsed === "object" &&
      parsed !== null &&
      "message" in parsed &&
      typeof (parsed as { message: unknown }).message === "string"
        ? (parsed as { message: string }).message
        : `Manufact Cloud API request failed (HTTP ${res.status})`;
    throw new ManufactApiError(message, res.status, rawText);
  }

  return parsed;
}
