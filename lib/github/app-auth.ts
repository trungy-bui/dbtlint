import { createAppAuth } from "@octokit/auth-app";

type CachedInstallationToken = {
  token: string;
  expiresAt: number;
};

type AppJwtClaims = {
  iss?: string;
  iat?: number;
  exp?: number;
};

type InstallationTokenResponse = {
  token?: unknown;
  expires_at?: unknown;
};

const installationTokenCache = new Map<string, CachedInstallationToken>();

function getGitHubAppCredentials() {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error(
      "GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be configured",
    );
  }

  return {
    appId,
    privateKey: privateKey.replace(/\\n/g, "\n").trim(),
  };
}

function createAuth() {
  return createAppAuth(getGitHubAppCredentials());
}

function decodeJwtClaims(jwt: string): AppJwtClaims {
  const payload = jwt.split(".")[1];

  if (!payload) return {};

  try {
    return JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as AppJwtClaims;
  } catch {
    return {};
  }
}

function redactTokenFromResponseBody(responseBody: string) {
  return responseBody.replace(
    /("token"\s*:\s*")[^"]+("\s*[,}])/g,
    "$1[REDACTED]$2",
  );
}

export async function getAppJwt(): Promise<string> {
  const { appId } = getGitHubAppCredentials();
  const authentication = await createAuth()({ type: "app" });
  const { iss, iat, exp } = decodeJwtClaims(authentication.token);

  console.info("[GitHub App debug] generated app JWT", {
    configuredAppId: appId,
    iss,
    iat,
    exp,
  });

  return authentication.token;
}

export async function getInstallationToken(
  installationId: string | number,
): Promise<string> {
  const cacheKey = String(installationId);
  const cached = installationTokenCache.get(cacheKey);

  if (cached && cached.expiresAt - Date.now() > 60_000) {
    return cached.token;
  }

  const appJwt = await getAppJwt();
  const response = await fetch(
    `https://api.github.com/app/installations/${encodeURIComponent(cacheKey)}/access_tokens`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${appJwt}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  const rawResponseBody = await response.text();

  console.info("[GitHub App debug] installation token response", {
    installationId: cacheKey,
    status: response.status,
    statusText: response.statusText,
    responseBody: redactTokenFromResponseBody(rawResponseBody),
  });

  if (!response.ok) {
    throw new Error(
      `GitHub installation token exchange failed (${response.status} ${response.statusText})`,
    );
  }

  const authentication = JSON.parse(
    rawResponseBody,
  ) as InstallationTokenResponse;

  if (
    typeof authentication.token !== "string" ||
    typeof authentication.expires_at !== "string"
  ) {
    throw new Error(
      "GitHub installation token response was missing token data",
    );
  }

  const expiresAt = Date.parse(authentication.expires_at);

  installationTokenCache.set(cacheKey, {
    token: authentication.token,
    expiresAt: Number.isNaN(expiresAt) ? Date.now() : expiresAt,
  });

  return authentication.token;
}
