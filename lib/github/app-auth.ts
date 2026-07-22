import { createAppAuth } from "@octokit/auth-app";

type CachedInstallationToken = {
  token: string;
  expiresAt: number;
};

const installationTokenCache = new Map<string, CachedInstallationToken>();

function getGitHubAppCredentials() {
  const appId = process.env.GITHUB_APP_ID;
  const base64PrivateKey = process.env.GITHUB_APP_PRIVATE_KEY_BASE64;
  const rawPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || (!base64PrivateKey && !rawPrivateKey)) {
    throw new Error(
      "GITHUB_APP_ID and either GITHUB_APP_PRIVATE_KEY_BASE64 or GITHUB_APP_PRIVATE_KEY must be configured",
    );
  }

  const decodedPrivateKey = base64PrivateKey
    ? Buffer.from(base64PrivateKey, "base64").toString("utf8")
    : undefined;
  const normalizedRawPrivateKey = rawPrivateKey?.replace(/\\n/g, "\n").trim();
  const privateKey = decodedPrivateKey ?? normalizedRawPrivateKey;

  if (!privateKey) {
    throw new Error("GitHub App private key decoded to an empty value");
  }

  return {
    appId,
    privateKey,
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
