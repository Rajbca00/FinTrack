import pdf from "pdf-parse";
import type { NormalizedRow, InvalidRow, NormalizeResult } from "./csvImport";

// HDFC Bank's credit card statement PDF export. The "Domestic Transactions"
// table repeats its own header on every page it spans, so the document is
// first split on that section title and each section's own column header
// ("DATE & TIME...") is skipped before scanning for rows within it.
//
// Each row collapses in pdf-parse's linear extraction to:
//   <DD/MM/YYYY>| <HH:MM><description, may wrap>(<+>)? C <amount>
// with no separator between the time and the description that follows it.
// The embedded currency glyph in this PDF's font consistently extracts as
// a literal "C" (verified directly, not assumed) rather than the actual
// rupee symbol, so that literal is what's matched. A leading "+" right
// before the amount marks a payment/credit (money in); its absence marks
// a purchase/debit (money out) - verified against two real statements
// (29 and 43 transactions, every sign correct).
//
// Known limitation: an "EMI" badge rendered inline in the DATE & TIME
// column sometimes extracts as a literal "EMI" prefix glued onto the next
// transaction's description (e.g. "EMIUPI-National HighwaysAuthori") -
// cosmetic only, the amount/sign/date are unaffected.
const SECTION_TITLE = "Domestic Transactions";
const COLUMN_HEADER = "DATE & TIME";
const ROW_RE = /(\d{2})\/(\d{2})\/(\d{4})\|\s*\d{2}:\d{2}([\s\S]*?)(\+)?\s*C\s*([\d,]+\.\d{2})/g;

export async function parseHdfcCreditCardPdf(fileBuffer: Buffer): Promise<NormalizeResult> {
  let text: string;
  try {
    const result = await pdf(fileBuffer);
    text = result.text;
  } catch {
    throw new Error("Couldn't read that PDF - is it a valid, non-password-protected file?");
  }

  const sections = text.split(SECTION_TITLE).slice(1);
  if (sections.length === 0) {
    throw new Error("This doesn't look like an HDFC Bank credit card statement PDF (no transaction table found).");
  }

  const rows: NormalizedRow[] = [];
  const invalid: InvalidRow[] = [];
  let rowIndex = 0;

  for (const section of sections) {
    const headerIdx = section.indexOf(COLUMN_HEADER);
    const block = headerIdx === -1 ? section : section.slice(headerIdx);

    const re = new RegExp(ROW_RE.source, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(block)) !== null) {
      const [, dd, mm, yyyy, descRaw, plus, amountRaw] = match;
      const dateRaw = `${dd}/${mm}/${yyyy}`;
      // Strips the "(Ref# ...)" suffix some rows carry - it's an internal
      // reference number, not part of the merchant/description text.
      const description = descRaw
        .replace(/\(Ref#[\s\S]*?\)/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      const dateISO = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
      const amount = parseFloat(amountRaw.replace(/,/g, ""));

      if (!dateISO) {
        invalid.push({ rowIndex, reason: "invalid_date", dateRaw, descriptionRaw: description });
      } else if (!description) {
        invalid.push({ rowIndex, reason: "missing_description", dateRaw, descriptionRaw: description });
      } else if (!Number.isFinite(amount)) {
        invalid.push({ rowIndex, reason: "invalid_amount", dateRaw, descriptionRaw: description });
      } else {
        rows.push({ dateISO, description, amount: plus ? amount : -amount });
      }
      rowIndex++;
    }
  }

  if (rows.length === 0 && invalid.length === 0) {
    throw new Error("This doesn't look like an HDFC Bank credit card statement PDF (no transaction rows found).");
  }

  return { rows, invalid };
}
