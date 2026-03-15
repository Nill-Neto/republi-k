import { describe, expect, it, vi } from "vitest";
import { resolveAppPublicUrl } from "./app";

describe("resolveAppPublicUrl", () => {
  it("uses configured url and removes trailing slash (staging/prod)", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const stagingResult = resolveAppPublicUrl("https://staging.republi-k.app/", {
      mode: "staging",
      isDev: false,
    });
    const prodResult = resolveAppPublicUrl("https://app.republi-k.com/", {
      mode: "production",
      isDev: false,
    });

    expect(stagingResult).toBe("https://staging.republi-k.app");
    expect(prodResult).toBe("https://app.republi-k.com");
    expect(infoSpy).toHaveBeenCalledTimes(2);
    infoSpy.mockRestore();
  });

  it("falls back in development", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = resolveAppPublicUrl(undefined, {
      mode: "development",
      isDev: true,
      fallbackUrl: "http://localhost:4173/",
    });

    expect(result).toBe("http://localhost:4173");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("throws in non-development env when missing", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      resolveAppPublicUrl(undefined, {
        mode: "production",
        isDev: false,
      })
    ).toThrow("APP_PUBLIC_URL is required outside development mode.");

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
