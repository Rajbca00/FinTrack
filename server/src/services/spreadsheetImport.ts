import ExcelJS from "exceljs";
import type { ParsedCsv } from "./csvImport";

// Converts a .xlsx/.xls file into the exact same {headers, rows} shape
// parseCsv() produces, so every downstream step (suggestMapping,
// detectDateFormat, normalizeRows, the column-mapping UI) is bank-agnostic
// and already works unchanged - this is purely a different way to get rows
// in, not a different import format.
export async function parseSpreadsheet(fileBuffer: Buffer): Promise<ParsedCsv> {
  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs's own Buffer type declaration doesn't line up with this
    // project's @types/node version (a type-only mismatch - Buffer really
    // is a Buffer at runtime either way).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(fileBuffer as any);
  } catch {
    throw new Error("Couldn't read that file - is it a valid, non-password-protected .xlsx/.xls file?");
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("This spreadsheet has no sheets to import from.");
  }

  let headers: string[] = [];
  const rows: Record<string, string>[] = [];

  worksheet.eachRow((row, rowNumber) => {
    const values = row.values as ExcelJS.CellValue[];
    // ExcelJS's row.values is 1-indexed (index 0 is always empty) - slicing
    // it off keeps column N lined up with headers[N] instead of off-by-one.
    const cells = values.slice(1);

    if (rowNumber === 1) {
      headers = cells.map((c) => cellToString(c).trim());
      return;
    }
    if (cells.every((c) => cellToString(c).trim() === "")) return; // blank row

    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h) record[h] = cellToString(cells[i]);
    });
    rows.push(record);
  });

  return { headers: headers.filter((h) => h !== ""), rows };
}

function cellToString(value: ExcelJS.CellValue | undefined): string {
  if (value == null) return "";
  if (value instanceof Date) {
    // Emitted as unambiguous ISO (not the locale-dependent DD/MM vs MM/DD
    // text a bank's own CSV export would use) since this came from a real
    // Excel date value, not typed/ambiguous text - date-only, no time-of-day,
    // to match how the rest of the app stores dates.
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "object") {
    // Rich text / formula / hyperlink cells - richText, or a computed
    // `result`, is what actually holds the field's real content.
    const obj = value as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(obj.richText)) return obj.richText.map((r) => r.text).join("");
    if (obj.result != null) return String(obj.result);
    if (obj.text != null) return String(obj.text);
    return "";
  }
  return String(value);
}
