export function safeNext(value: string | undefined | null): string {
  if (!value) return "/account";
  if (!value.startsWith("/")) return "/account";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/account";
  if (value.includes("://")) return "/account";
  return value;
}
