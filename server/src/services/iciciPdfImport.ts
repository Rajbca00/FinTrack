import pdf from "pdf-parse";
import type { NormalizedRow, InvalidRow, NormalizeResult } from "./csvImport";

// ICICI Bank's "Statement of Transactions" PDF export lists one row per
// transaction across three visible columns - Withdrawal Amount, Deposit
// Amount, Balance - but only one of Withdrawal/Deposit is ever populated per
// row. pdf-parse's linear text extraction drops empty cells entirely and
// loses the column boundaries, so each row collapses to a repeating block:
//   <S No><DD.MM.YYYY>          (glued onto one line, no separator)
//   <remarks, wraps across a variable number of lines>
//   <amount><balance>            (glued onto one line, no separator)
// with no way to tell from the row alone whether <amount> was a withdrawal
// or a deposit. Verified against a real statement (168 transactions): every
// row's own balance minus the *previous* row's balance equals exactly
// +amount (deposit) or -amount (withdrawal), with zero ambiguous cases - so
// the sign is derived from that delta rather than guessed. The one
// structural exception is a statement's very first transaction, which has
// no prior balance to diff against; see InvalidRow's "uncertain_sign".
const SNO_DATE_RE = /^(\d+)(\d{2}\.\d{2}\.\d{4})$/;
const AMOUNT_BALANCE_RE = /^(\d+\.\d{2})(\d+\.\d{2})$/;

function parseIciciDate(raw: string): string | null {
  const m = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const parsed = new Date(Number(y), Number(mo) - 1, Number(d));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

type RawRow = { sno: number; dateRaw: string; remarksLines: string[]; amount: number; balance: number };

export async function parseIciciPdf(fileBuffer: Buffer): Promise<NormalizeResult> {
  let text: string;
  try {
    const result = await pdf(fileBuffer);
    text = result.text;
  } catch {
    throw new Error("Couldn't read that PDF - is it a valid, non-password-protected file?");
  }

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rawRows: RawRow[] = [];
  let current: Omit<RawRow, "amount" | "balance"> | null = null;

  for (const line of lines) {
    const snoMatch = line.match(SNO_DATE_RE);
    const amountMatch = line.match(AMOUNT_BALANCE_RE);

    if (snoMatch) {
      // A new row header always starts a fresh block - anything collected
      // for a still-open block with no closing amount/balance line (should
      // not normally happen) is simply discarded rather than mis-attributed.
      current = { sno: Number(snoMatch[1]), dateRaw: snoMatch[2], remarksLines: [] };
      continue;
    }
    if (amountMatch && current) {
      rawRows.push({ ...current, amount: Number(amountMatch[1]), balance: Number(amountMatch[2]) });
      current = null;
      continue;
    }
    // Anything else - remarks continuation once a block is open, or
    // header/footer/address/legend boilerplate between blocks - is only
    // ever collected as remarks text; boilerplate outside an open block is
    // silently ignored, matching every other importer's "skip what we don't
    // recognize" behavior.
    if (current) current.remarksLines.push(line);
  }

  if (rawRows.length === 0) {
    throw new Error("This doesn't look like an ICICI Bank account statement PDF (no transaction rows found).");
  }

  const rows: NormalizedRow[] = [];
  const invalid: InvalidRow[] = [];

  rawRows.forEach((r, i) => {
    const rowIndex = i;
    const dateISO = parseIciciDate(r.dateRaw);
    const description = r.remarksLines.join(" ").replace(/\s+/g, " ").trim();

    if (!dateISO) {
      invalid.push({ rowIndex, reason: "invalid_date", dateRaw: r.dateRaw, descriptionRaw: description });
      return;
    }
    if (!description) {
      invalid.push({ rowIndex, reason: "missing_description", dateRaw: r.dateRaw, descriptionRaw: description });
      return;
    }

    if (i === 0) {
      invalid.push({ rowIndex, reason: "uncertain_sign", dateRaw: r.dateRaw, descriptionRaw: description });
      return;
    }

    const prevBalance = rawRows[i - 1].balance;
    const delta = r.balance - prevBalance;
    const isDeposit = Math.abs(delta - r.amount) < 0.01;
    const isWithdrawal = Math.abs(delta + r.amount) < 0.01;

    if (isDeposit === isWithdrawal) {
      // Neither (or, in principle, both) matched - the balance sequence
      // doesn't reconcile for this row, so its sign genuinely can't be
      // trusted rather than silently picking one.
      invalid.push({ rowIndex, reason: "uncertain_sign", dateRaw: r.dateRaw, descriptionRaw: description });
      return;
    }

    rows.push({ dateISO, description, amount: isDeposit ? r.amount : -r.amount });
  });

  return { rows, invalid };
}
