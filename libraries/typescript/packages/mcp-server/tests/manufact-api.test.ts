import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchUsersMe, ManufactApiError } from "../src/manufact-api.js";

describe("fetchUsersMe", () => {
  const originalFetch = globalThis.fetch;
  const originalBase = process.env.MANUFACT_CLOUD_API_BASE_URL;

  beforeEach(() => {
    process.env.MANUFACT_CLOUD_API_BASE_URL = "https://example.test/api/v1";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalBase === undefined) {
      delete process.env.MANUFACT_CLOUD_API_BASE_URL;
    } else {
      process.env.MANUFACT_CLOUD_API_BASE_URL = originalBase;
    }
    vi.restoreAllMocks();
  });

  it("returns JSON body on success", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe("https://example.test/api/v1/users/me");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer token-abc",
        Accept: "application/json",
      });
      return new Response(JSON.stringify({ id: "u1", email: "a@b.co" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const data = await fetchUsersMe("token-abc");
    expect(data).toEqual({ id: "u1", email: "a@b.co" });
  });

  it("throws ManufactApiError on HTTP error with JSON message", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ message: "nope" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    await expect(fetchUsersMe("bad")).rejects.toMatchObject({
      name: "ManufactApiError",
      message: "nope",
      status: 401,
    });
  });

  it("throws ManufactApiError when response is not JSON", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response("not json", { status: 500 });
    }) as typeof fetch;

    try {
      await fetchUsersMe("t");
      expect.fail("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ManufactApiError);
      expect((e as ManufactApiError).status).toBe(500);
    }
  });
});
