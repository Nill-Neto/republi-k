const DEFAULT_DEV_PUBLIC_URL = "http://localhost:8080";

export const resolveAppPublicUrl = (
  appPublicUrl: string | undefined,
  options: {
    mode: string;
    isDev: boolean;
    fallbackUrl?: string;
  }
) => {
  const normalizedConfiguredUrl = appPublicUrl?.trim().replace(/\/$/, "");

  if (normalizedConfiguredUrl) {
    console.info(`[app-config] APP_PUBLIC_URL (${options.mode}): ${normalizedConfiguredUrl}`);
    return normalizedConfiguredUrl;
  }

  const fallbackUrl = options.fallbackUrl?.trim().replace(/\/$/, "") || DEFAULT_DEV_PUBLIC_URL;
  const message = `[app-config] APP_PUBLIC_URL is not configured for mode \"${options.mode}\".`;

  if (options.isDev) {
    console.warn(`${message} Falling back to ${fallbackUrl}.`);
    return fallbackUrl;
  }

  console.error(`${message} Configure APP_PUBLIC_URL for this environment.`);
  throw new Error("APP_PUBLIC_URL is required outside development mode.");
};

export const APP_PUBLIC_URL = resolveAppPublicUrl(import.meta.env.APP_PUBLIC_URL, {
  mode: import.meta.env.MODE,
  isDev: import.meta.env.DEV || import.meta.env.MODE === "test",
  fallbackUrl: typeof window !== "undefined" ? window.location.origin : DEFAULT_DEV_PUBLIC_URL,
});
