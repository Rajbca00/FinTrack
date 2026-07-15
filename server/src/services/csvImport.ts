import Papa from "papaparse";

export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
};

export function parseCsv(content: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const headers = result.meta.fields ?? [];
  const rows = (result.data ?? []).filter((r) => Object.values(r).some((v) => (v ?? "").toString().trim() !== ""));
  return { headers, rows };
}

const DATE_HINTS = ["date", "txn date", "value date", "transaction date"];
const DESC_HINTS = ["narration", "description", "particulars", "details", "transaction details"];
const DEBIT_HINTS = ["debit", "withdrawal", "withdrawal amt"];
const CREDIT_HINTS = ["credit", "deposit", "deposit amt"];
const AMOUNT_HINTS = ["amount", "amt"];

function findHeader(headers: string[], hints: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase());
  for (const hint of hints) {
    const idx = lower.findIndex((h) => h.includes(hint));
    if (idx !== -1) return headers[idx];
  }
  return null;
}

export type SuggestedMapping = {
  dateColumn: string | null;
  descriptionColumn: string | null;
  debitColumn: string | null;
  creditColumn: string | null;
  amountColumn: string | null;
};

export function suggestMapping(headers: string[]): SuggestedMapping {
  const debitColumn = findHeader(headers, DEBIT_HINTS);
  const creditColumn = findHeader(headers, CREDIT_HINTS);
  return {
    dateColumn: findHeader(headers, DATE_HINTS),
    descriptionColumn: findHeader(headers, DESC_HINTS),
    debitColumn,
    creditColumn,
    // Only suggest a single signed amount column when there's no separate debit/credit pair.
    amountColumn: debitColumn || creditColumn ? null : findHeader(headers, AMOUNT_HINTS),
  };
}

// Which position the day falls in for ambiguous slash/dash-separated dates
// (e.g. "03/04/2026") - there's no way to tell from a single date string
// whether that's 3 Apr or Mar 4, so this must come from the user (via
// auto-detection across the whole file where possible, else a manual pick).
export type DateFormat = "DMY" | "MDY" | "YMD";

export type ColumnMapping = {
  dateColumn: string;
  descriptionColumn: string;
  // Either amountColumn (signed, or use amountSign hint) OR debit+credit columns.
  amountColumn?: string;
  debitColumn?: string;
  creditColumn?: string;
  // If amountColumn values are unsigned magnitudes, this says whether positive means debit.
  invertAmount?: boolean;
  // Defaults to "DMY" (matches the previous hard-coded behavior) when omitted.
  dateFormat?: DateFormat;
};

export type NormalizedRow = {
  dateISO: string;
  description: string;
  amount: number; // positive = inflow, negative = outflow
};

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// Matches "07/10/2026" or "07-10-2026" - the ambiguous slash/dash shape where
// the day could be in either the first or second position. Deliberately not
// anchored at the end: some exports (seen in credit card statements) append
// a time-of-day after the date, e.g. "13/05/2026 / 00:00" - the date is
// always the leading component, and the app stores dates without a
// time-of-day anyway, so anything trailing the date itself is ignored
// rather than making the whole value fail to parse.
const AMBIGUOUS_DATE_RE = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/;

function parseDate(raw: string, dateFormat: DateFormat = "DMY"): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(AMBIGUOUS_DATE_RE);
  if (match) {
    const [, a, b, yRaw] = match;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    const [d, m] = dateFormat === "MDY" ? [b, a] : [a, b];
    const iso = new Date(Number(y), Number(m) - 1, Number(d));
    if (!Number.isNaN(iso.getTime())) return iso.toISOString();
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return null;
}

// Scans every value in a date column and infers DMY vs MDY from whichever
// position ever exceeds 12 (which can only be a day, never a month) - e.g.
// a "25/03/2026" anywhere in the file proves the file is day-first. Falls
// back to DMY (the previous hard-coded assumption) when the file never
// disambiguates itself, since that's still the more common convention
// (e.g. Indian/UK bank exports) and matches prior behavior for such files.
export function detectDateFormat(values: string[]): DateFormat {
  for (const raw of values) {
    const match = (raw ?? "").trim().match(AMBIGUOUS_DATE_RE);
    if (!match) continue;
    const a = Number(match[1]);
    const b = Number(match[2]);
    if (a > 12) return "DMY";
    if (b > 12) return "MDY";
  }
  return "DMY";
}

export type InvalidRow = {
  rowIndex: number; // 0-based position in the CSV's data rows
  reason: "invalid_date" | "missing_description";
  dateRaw: string;
  descriptionRaw: string;
};

export type NormalizeResult = {
  rows: NormalizedRow[];
  invalid: InvalidRow[];
};

// Rows with an unparseable date or an empty description can't become a
// transaction, but silently dropping them with no trace is exactly what
// makes an importer feel untrustworthy for financial data - every caller
// needs to be able to tell the user "N detected, M skipped, here's why"
// instead of just an unexplained gap between the two counts.
export function normalizeRows(rows: Record<string, string>[], mapping: ColumnMapping): NormalizeResult {
  const out: NormalizedRow[] = [];
  const invalid: InvalidRow[] = [];
  rows.forEach((row, rowIndex) => {
    const dateRaw = row[mapping.dateColumn] ?? "";
    const descriptionRaw = row[mapping.descriptionColumn] ?? "";
    const dateISO = parseDate(dateRaw, mapping.dateFormat);
    const description = descriptionRaw.trim();

    if (!dateISO) {
      invalid.push({ rowIndex, reason: "invalid_date", dateRaw, descriptionRaw });
      return;
    }
    if (!description) {
      invalid.push({ rowIndex, reason: "missing_description", dateRaw, descriptionRaw });
      return;
    }

    let amount: number;
    if (mapping.amountColumn) {
      amount = parseAmount(row[mapping.amountColumn]);
      if (mapping.invertAmount) amount = -amount;
    } else {
      const debit = parseAmount(mapping.debitColumn ? row[mapping.debitColumn] : undefined);
      const credit = parseAmount(mapping.creditColumn ? row[mapping.creditColumn] : undefined);
      amount = credit - Math.abs(debit);
    }
    out.push({ dateISO, description, amount });
  });
  return { rows: out, invalid };
}
