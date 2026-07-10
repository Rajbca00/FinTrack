import { createHash } from "crypto";

export function dedupeKey(dateISO: string, description: string, amount: number): string {
  const normalized = `${dateISO}|${description.trim().toLowerCase()}|${amount.toFixed(2)}`;
  return createHash("sha1").update(normalized).digest("hex");
}
