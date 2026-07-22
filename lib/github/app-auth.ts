import { createAppAuth } from "@octokit/auth-app";

type CachedInstallationToken = {
  token: string;
  expiresAt: number;
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

export async function getAppJwt(): Promise<string> {
  const authentication = await createAuth()({ type: "app" });
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

  const authentication = await createAuth()({
    type: "installation",
    installationId: Number(installationId),
  });
  const expiresAt = Date.parse(authentication.expiresAt);

  installationTokenCache.set(cacheKey, {
    token: authentication.token,
    expiresAt: Number.isNaN(expiresAt) ? Date.now() : expiresAt,
  });

  return authentication.token;
}
