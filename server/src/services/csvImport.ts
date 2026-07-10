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

export type ColumnMapping = {
  dateColumn: string;
  descriptionColumn: string;
  // Either amountColumn (signed, or use amountSign hint) OR debit+credit columns.
  amountColumn?: string;
  debitColumn?: string;
  creditColumn?: string;
  // If amountColumn values are unsigned magnitudes, this says whether positive means debit.
  invertAmount?: boolean;
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

function parseDate(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    let [, d, m, y] = dmy;
    if (y.length === 2) y = `20${y}`;
    const iso = new Date(Number(y), Number(m) - 1, Number(d));
    if (!Number.isNaN(iso.getTime())) return iso.toISOString();
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return null;
}

export function normalizeRows(rows: Record<string, string>[], mapping: ColumnMapping): NormalizedRow[] {
  const out: NormalizedRow[] = [];
  for (const row of rows) {
    const dateISO = parseDate(row[mapping.dateColumn] ?? "");
    const description = (row[mapping.descriptionColumn] ?? "").trim();
    if (!dateISO || !description) continue;

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
  }
  return out;
}
