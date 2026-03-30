import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MANUFACT_API_TIMEOUT_MS,
  DEFAULT_MANUFACT_LOG_TIMEOUT_MS,
  getDeploymentBuildLogs,
  getDeploymentLogs,
  getOrganization,
  listDeployments,
  listOrganizations,
  ManufactApiError,
  requestManufactApi,
  restartDeployment,
  startDeployment,
  stopDeployment,
} from "../src/utils/manufact-api.js";

describe("manufact api helpers", () => {
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

  it("requestManufactApi returns parsed JSON on success", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe("https://example.test/api/v1/profiles");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer token-abc",
        Accept: "application/json",
      });
      return new Response(JSON.stringify([{ id: "org_1", profile_name: "Acme" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const data = await requestManufactApi({
      accessToken: "token-abc",
      path: "/profiles",
    });
    expect(data).toEqual([{ id: "org_1", profile_name: "Acme" }]);
  });

  it("adds JSON body and x-profile-id when provided", async () => {
    globalThis.fetch = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      expect(init?.method).toBe("PATCH");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer token-abc",
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-profile-id": "prof_123",
      });
      expect(init?.body).toBe(JSON.stringify({ status: "running" }));
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    await requestManufactApi({
      accessToken: "token-abc",
      path: "/deployments/dep_1",
      method: "PATCH",
      profileId: "prof_123",
      body: { status: "running" },
    });
  });

  it("throws ManufactApiError on HTTP error with JSON message", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ message: "nope" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    await expect(
      requestManufactApi({
        accessToken: "bad",
        path: "/profiles",
      })
    ).rejects.toMatchObject({
      name: "ManufactApiError",
      message: "nope",
      status: 401,
      retryAfter: null,
    });
  });

  it("throws ManufactApiError when response is not JSON", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response("not json", { status: 500 });
    }) as typeof fetch;

    try {
      await requestManufactApi({
        accessToken: "t",
        path: "/profiles",
      });
      expect.fail("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ManufactApiError);
      expect((e as ManufactApiError).status).toBe(500);
      expect((e as ManufactApiError).body).toBe("not json");
    }
  });

  it("includes Retry-After on API errors", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ message: "slow down" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "30",
        },
      });
    }) as typeof fetch;

    await expect(
      requestManufactApi({
        accessToken: "t",
        path: "/deployments",
      })
    ).rejects.toMatchObject({
      name: "ManufactApiError",
      status: 429,
      retryAfter: "30",
    });
  });

  it("normalizes listDeployments when the API returns an array", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify([{ id: "dep_1" }, { id: "dep_2" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    await expect(listDeployments("token-abc")).resolves.toEqual({
      deployments: [{ id: "dep_1" }, { id: "dep_2" }],
      total: 2,
    });
  });

  it("normalizes deployment logs from raw text or nested data", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("build output", {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { logs: "runtime output" },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      ) as typeof fetch;

    await expect(getDeploymentBuildLogs("token-abc", "dep_1")).resolves.toEqual({
      logs: "build output",
    });
    await expect(getDeploymentLogs("token-abc", "dep_1")).resolves.toEqual({
      data: { logs: "runtime output" },
      logs: "runtime output",
    });
  });

  it("uses the correct paths and methods for locked endpoint helpers", async () => {
    const seen: Array<{
      url: string;
      method: string;
      body?: string;
    }> = [];

    globalThis.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      seen.push({
        url: String(url),
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? init.body : undefined,
      });

      return new Response(JSON.stringify({ id: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    await listOrganizations("token-abc");
    await getOrganization("token-abc", "prof_1");
    await restartDeployment("token-abc", "dep_1");
    await stopDeployment("token-abc", "dep_2");
    await startDeployment("token-abc", "dep_3");

    expect(seen).toEqual([
      {
        url: "https://example.test/api/v1/profiles",
        method: "GET",
        body: undefined,
      },
      {
        url: "https://example.test/api/v1/profiles/prof_1",
        method: "GET",
        body: undefined,
      },
      {
        url: "https://example.test/api/v1/deployments/dep_1/redeploy",
        method: "POST",
        body: undefined,
      },
      {
        url: "https://example.test/api/v1/deployments/dep_2",
        method: "PATCH",
        body: JSON.stringify({ status: "stopped" }),
      },
      {
        url: "https://example.test/api/v1/deployments/dep_3",
        method: "PATCH",
        body: JSON.stringify({ status: "running" }),
      },
    ]);
  });

  it("times out standard requests after the default timeout", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn((_url: string | URL, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    }) as typeof fetch;

    const promise = requestManufactApi({
      accessToken: "token-abc",
      path: "/profiles",
    });
    const assertion = expect(promise).rejects.toThrow("Request timeout after 30s.");

    await vi.advanceTimersByTimeAsync(DEFAULT_MANUFACT_API_TIMEOUT_MS);

    await assertion;
    vi.useRealTimers();
  });

  it("uses the longer timeout policy for log helpers", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn((_url: string | URL, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    }) as typeof fetch;

    const promise = getDeploymentLogs("token-abc", "dep_1");
    const assertion = expect(promise).rejects.toThrow("Request timeout after 60s.");

    await vi.advanceTimersByTimeAsync(DEFAULT_MANUFACT_LOG_TIMEOUT_MS);

    await assertion;
    vi.useRealTimers();
  });

  it("supports explicit per-request timeouts", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn((_url: string | URL, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    }) as typeof fetch;

    const promise = getDeploymentLogs("token-abc", "dep_1", { timeoutMs: 5_000 });
    const assertion = expect(promise).rejects.toThrow("Request timeout after 5s.");

    await vi.advanceTimersByTimeAsync(5_000);

    await assertion;
    vi.useRealTimers();
  });

  it("preserves pre-aborted external signals", async () => {
    const controller = new AbortController();
    controller.abort();

    globalThis.fetch = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      expect(init?.signal?.aborted).toBe(true);
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    }) as typeof fetch;

    await expect(
      requestManufactApi({
        accessToken: "token-abc",
        path: "/profiles",
        signal: controller.signal,
      })
    ).rejects.toThrow("aborted");
  });

  it("returns empty deployments when list payload is unexpected", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    await expect(listDeployments("token-abc")).resolves.toEqual({
      deployments: [],
    });
  });
});
