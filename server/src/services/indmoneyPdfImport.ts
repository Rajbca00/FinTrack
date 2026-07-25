import pdf from "pdf-parse";
import type { NormalizedRow, InvalidRow, NormalizeResult } from "./csvImport";

// IndMoney's "Account Statement" PDF export (Account Aggregator, via FINVU)
// lists transactions newest-first as repeating blocks of:
//   <Weekday>, <DD> <Mon>'<YY>
//   <narration, may wrap onto multiple lines>
//   Transaction ID: <digits>
//   <+|->₹<amount>₹<running balance>
// Same-day transactions sometimes repeat the date line and sometimes don't
// (seen with paired fee/reversal rows) - splitting the whole document on
// date-line occurrences and treating every date as "in effect until the next
// one" handles both cases without needing every row to carry its own date.
const DATE_LINE = /([A-Za-z]{3}, \d{2} [A-Za-z]{3}'\d{2})/;
// Amount and balance run together with no separator ("-₹89₹46,708.04"), and
// at least one real statement row has been observed with a stray extra "-"
// between the currency symbol and the digits ("-₹-5,000") - harmless once
// the leading +/- is what actually decides sign, so the extra dash is just
// swallowed rather than treated as a second, conflicting sign.
const TXN_BLOCK = /([\s\S]*?)\nTransaction ID: (\d+)\n([+-])₹-?([\d,]+(?:\.\d+)?)₹([\d,]+(?:\.\d+)?)/g;

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ""));
}

function parseDateHeader(dateLine: string): string | null {
  // "Fri, 24 Jul'26" -> day/month/2-digit-year, no weekday needed once split.
  const m = dateLine.match(/(\d{2}) ([A-Za-z]{3})'(\d{2})/);
  if (!m) return null;
  const [, day, mon, yy] = m;
  const parsed = new Date(`${day} ${mon} 20${yy}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function parseIndmoneyPdf(fileBuffer: Buffer): Promise<NormalizeResult> {
  let text: string;
  try {
    const result = await pdf(fileBuffer);
    text = result.text;
  } catch {
    throw new Error("Couldn't read that PDF - is it a valid, non-password-protected file?");
  }

  const parts = text.split(new RegExp(DATE_LINE.source, "g"));
  if (parts.length < 3) {
    throw new Error("This doesn't look like an IndMoney account statement PDF (no transaction dates found).");
  }

  const rows: NormalizedRow[] = [];
  const invalid: InvalidRow[] = [];
  let rowIndex = 0;

  for (let i = 1; i < parts.length; i += 2) {
    const dateRaw = parts[i];
    const chunk = parts[i + 1] ?? "";
    const dateISO = parseDateHeader(dateRaw);

    const blockRe = new RegExp(TXN_BLOCK.source, "g");
    let match: RegExpExecArray | null;
    while ((match = blockRe.exec(chunk)) !== null) {
      const [, narrationRaw, , sign, amountRaw] = match;
      const description = narrationRaw.replace(/\s+/g, " ").trim();
      const magnitude = parseAmount(amountRaw);

      if (!dateISO) {
        invalid.push({ rowIndex, reason: "invalid_date", dateRaw, descriptionRaw: description });
      } else if (!description) {
        invalid.push({ rowIndex, reason: "missing_description", dateRaw, descriptionRaw: description });
      } else if (!Number.isFinite(magnitude)) {
        invalid.push({ rowIndex, reason: "invalid_amount", dateRaw, descriptionRaw: description });
      } else {
        rows.push({ dateISO, description, amount: sign === "-" ? -magnitude : magnitude });
      }
      rowIndex++;
    }
  }

  return { rows, invalid };
}
