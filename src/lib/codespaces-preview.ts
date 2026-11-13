/**
 * Codespaces' private port proxy can rewrite Origin to localhost while keeping
 * the public hostname in X-Forwarded-Host. This exception is strictly limited
 * to an explicitly configured development Codespace on port 3000.
 */
export function codespacesPreviewHost(input: {
  nodeEnv?: string;
  appEnv?: string;
  codespaces?: string;
  name?: string;
  domain?: string;
  appUrl?: string;
}): string | null {
  if (input.nodeEnv !== "development" || input.appEnv !== "development" || input.codespaces !== "true") return null;
  const name = input.name ?? "";
  const domain = input.domain || "app.github.dev";
  // These values are supplied by Codespaces, not by request headers.
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(name)) return null;
  if (!/^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?)+$/.test(domain)) return null;
  const host = `${name}-3000.${domain}`;
  try {
    const url = new URL(input.appUrl ?? "");
    if (url.origin !== `https://${host}` || url.username || url.password) return null;
  } catch {
    return null;
  }
  return host;
}

export function currentCodespacesPreviewHost(appUrl: string): string | null {
  return codespacesPreviewHost({
    nodeEnv: process.env.NODE_ENV,
    appEnv: process.env.APP_ENV,
    codespaces: process.env.CODESPACES,
    name: process.env.CODESPACE_NAME,
    domain: process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN,
    appUrl,
  });
}

/** Only a browser-initiated same-origin request via this exact proxy qualifies. */
export function isCodespacesSameOriginRequest(headers: Headers, expectedHost: string | null): boolean {
  return expectedHost !== null &&
    headers.get("origin") === "http://localhost:3000" &&
    headers.get("x-forwarded-host") === expectedHost &&
    headers.get("sec-fetch-site") === "same-origin";
}

/**
 * Guard every browser mutation before Next's Server Actions run, not just the
 * actions that have their own CSRF guard. API calls without browser metadata
 * remain available for signature-authenticated webhooks and plugin clients.
 */
export function isAllowedCodespacesMutation(headers: Headers, host: string, pathname: string): boolean {
  const origin = headers.get("origin");
  const fetchSite = headers.get("sec-fetch-site");
  if (pathname.startsWith("/api/") && !origin && !fetchSite) return true;
  return fetchSite === "same-origin" &&
    headers.get("x-forwarded-host") === host &&
    (origin === "http://localhost:3000" || origin === `https://${host}`);
}
