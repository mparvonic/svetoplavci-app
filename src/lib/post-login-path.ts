const DEFAULT_POST_LOGIN_PATH = "/";

export function getPostLoginDefaultPath(): string {
  const raw = process.env.POST_LOGIN_DEFAULT_PATH?.trim();
  if (!raw) return DEFAULT_POST_LOGIN_PATH;
  if (!raw.startsWith("/")) return DEFAULT_POST_LOGIN_PATH;
  return raw;
}

export function isCustomPostLoginPath(): boolean {
  return getPostLoginDefaultPath() !== DEFAULT_POST_LOGIN_PATH;
}
