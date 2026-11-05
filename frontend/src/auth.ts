export type UserRole = "customer" | "admin";
export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
}
export const SESSION_KEY = "ssu-mall-session-v1";
const accounts = [
  {
    id: "demo-admin",
    username: "admin",
    password: "admin",
    displayName: "관리자",
    role: "admin",
  },
  {
    id: "demo-customer",
    username: "user",
    password: "user",
    displayName: "숭실인",
    role: "customer",
  },
] as const;
// Both roles authenticate through the same function. Only account data assigns roles.
export function authenticateDemo(
  username: string,
  password: string,
): SessionUser | null {
  const account = accounts.find(
    (a) => a.username === username && a.password === password,
  );
  if (!account) return null;
  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    role: account.role,
  };
}
export function canManageShop(user: SessionUser | null): boolean {
  return user?.role === "admin";
}
export function parseSession(raw: string | null): SessionUser | null {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object") return null;
    const session = value as Partial<SessionUser>;
    const account = accounts.find(
      (a) =>
        a.id === session.id &&
        a.username === session.username &&
        a.role === session.role,
    );
    return account
      ? {
          id: account.id,
          username: account.username,
          displayName: account.displayName,
          role: account.role,
        }
      : null;
  } catch {
    return null;
  }
}
export function loginDestination(
  user: SessionUser,
  returnTo: string | null,
): string {
  if (!returnTo) return "/";
  if (/^\/admin(?:\/(?:products|inventory|orders))?$/.test(returnTo))
    return canManageShop(user) ? returnTo : "/";
  if (
    /^\/(?:mypage|cart|checkout|orders(?:\/SSU-[A-Z0-9-]+)?|products\/\d+)$/.test(
      returnTo,
    )
  )
    return returnTo;
  return "/";
}
