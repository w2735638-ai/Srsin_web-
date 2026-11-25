export type RuntimeEnvSource = Record<string, unknown> | undefined;

function readEnvVar(key: string, source?: RuntimeEnvSource): string {
  const fromSource = source?.[key];
  if (typeof fromSource === "string" && fromSource.trim().length > 0) {
    return fromSource.trim();
  }
  const fromProcess = typeof process !== "undefined" ? process.env?.[key] : undefined;
  if (typeof fromProcess === "string" && fromProcess.trim().length > 0) {
    return fromProcess.trim();
  }
  return "";
}

export function getEnv(source?: RuntimeEnvSource) {
  return {
    appId: readEnvVar("VITE_APP_ID", source) || readEnvVar("MANUS_PROJECT_ID", source),
    cookieSecret: readEnvVar("JWT_SECRET", source),
    databaseUrl: readEnvVar("TURSO_DATABASE_URL", source) || readEnvVar("DATABASE_URL", source),
    databaseAuthToken: readEnvVar("TURSO_AUTH_TOKEN", source),
    oAuthServerUrl: readEnvVar("OAUTH_SERVER_URL", source) || readEnvVar("MANUS_API_URL", source),
    ownerOpenId: readEnvVar("OWNER_OPEN_ID", source),
    isProduction: readEnvVar("NODE_ENV", source) === "production",
    forgeApiUrl: readEnvVar("BUILT_IN_FORGE_API_URL", source) || readEnvVar("MANUS_API_URL", source),
    forgeApiKey: readEnvVar("BUILT_IN_FORGE_API_KEY", source),
    adminPassword: readEnvVar("ADMIN_PASSWORD", source),
  };
}

export const ENV = getEnv();
