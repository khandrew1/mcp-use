import { describe, expect, it } from "vitest";
import {
  deploymentPrimaryUrl,
  initialsFromLabel,
  statusBadgeKind,
} from "../resources/lib/widget-helpers";

describe("initialsFromLabel", () => {
  it("uses first letters of two words", () => {
    expect(initialsFromLabel("Acme Corp")).toBe("AC");
  });

  it("truncates single token", () => {
    expect(initialsFromLabel("Manufact", 2)).toBe("MA");
  });

  it("handles empty", () => {
    expect(initialsFromLabel("")).toBe("?");
  });
});

describe("deploymentPrimaryUrl", () => {
  it("prefixes domain with https", () => {
    expect(deploymentPrimaryUrl({ domain: "app.example.com" })).toBe(
      "https://app.example.com"
    );
  });

  it("prefers customDomain", () => {
    expect(
      deploymentPrimaryUrl({
        domain: "a.example.com",
        customDomain: "b.example.com",
      })
    ).toBe("https://b.example.com");
  });

  it("passes through absolute URLs", () => {
    expect(
      deploymentPrimaryUrl({ domain: "https://already.example/path" })
    ).toBe("https://already.example/path");
  });
});

describe("statusBadgeKind", () => {
  it("maps running to success", () => {
    expect(statusBadgeKind("running")).toBe("success");
  });

  it("maps failed to destructive", () => {
    expect(statusBadgeKind("failed")).toBe("destructive");
  });
});
