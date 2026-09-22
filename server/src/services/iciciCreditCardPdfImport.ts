import pdf from "pdf-parse";
import type { NormalizedRow, InvalidRow, NormalizeResult } from "./csvImport";

// ICICI Bank's credit card "View Last Statement" PDF export. Each row in
// pdf-parse's linear extraction collapses to:
//   <DD-MM-YYYY><description, may wrap>eg <amount> Dr.|Cr.<rewardPoints><referenceNumber>
// with no separators between fields. Verified against a real statement
// (28 transactions, all amounts/signs/dates correct): the reference number
// is always exactly 11 digits, so <rewardPoints><referenceNumber> - itself
// glued with no separator - splits unambiguously by taking the last 11
// digits as the reference and whatever (possibly negative) digits remain
// before them as reward points. "Dr." (money out) is negative, "Cr."
// (money in, e.g. a payment received) is positive.
//
// Known limitation: a description that wraps onto a line rendered *after*
// the amount/points/reference columns (seen once in the sample statement,
// for a merchant name split across that boundary) loses that trailing
// fragment - the transaction itself, its amount, its sign, and its date
// are still parsed correctly, only the description text is incomplete in
// that rare case.
const ROW_RE = /(\d{2})-(\d{2})-(\d{4})([\s\S]*?)([\d,]+\.?\d*)\s(Dr|Cr)\.(-?\d+)(\d{11})/g;

export async function parseIciciCreditCardPdf(fileBuffer: Buffer): Promise<NormalizeResult> {
  let text: string;
  try {
    const result = await pdf(fileBuffer);
    text = result.text;
  } catch {
    throw new Error("Couldn't read that PDF - is it a valid, non-password-protected file?");
  }

  const startIdx = text.indexOf("Transaction Details");
  if (startIdx === -1) {
    throw new Error("This doesn't look like an ICICI Bank credit card statement PDF (no transaction table found).");
  }
  const block = text.slice(startIdx);

  const rows: NormalizedRow[] = [];
  const invalid: InvalidRow[] = [];
  let rowIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(ROW_RE.source, "g");

  while ((match = re.exec(block)) !== null) {
    const [, dd, mm, yyyy, descRaw, amountRaw, sign] = match;
    const dateRaw = `${dd}-${mm}-${yyyy}`;
    const description = descRaw.replace(/\s+/g, " ").trim();
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
      rows.push({ dateISO, description, amount: sign === "Dr" ? -amount : amount });
    }
    rowIndex++;
  }

  if (rows.length === 0 && invalid.length === 0) {
    throw new Error("This doesn't look like an ICICI Bank credit card statement PDF (no transaction rows found).");
  }

  return { rows, invalid };
}
