import { useRef, useState } from "react";
import { Modal, Button, Select, Label } from "./ui";
import {
  previewImport,
  confirmImport,
  previewIndmoneyImport,
  confirmIndmoneyImport,
  previewIndmoneyPdfImport,
  confirmIndmoneyPdfImport,
  previewIciciPdfImport,
  confirmIciciPdfImport,
  previewIciciCcPdfImport,
  confirmIciciCcPdfImport,
  previewHdfcCcPdfImport,
  confirmHdfcCcPdfImport,
  getErrorMessage,
  type ColumnMapping,
  type DateFormat,
  type ImportPreview,
  type IndmoneyPreview,
  type ImportResult,
} from "../lib/api";
import type { Group } from "../lib/api";
import { formatDate, formatMoney } from "../lib/format";
import { useQueryClient } from "@tanstack/react-query";

// Every PDF statement source shares the exact same upload -> preview ->
// review -> confirm flow, differing only in which parser the server runs
// and how the tab/upload panel describes itself - kept in one table
// instead of a separate state var + handler + tab + panel per bank, which
// stopped scaling once a second bank's PDF format showed up.
const PDF_SOURCES = {
  "icici-pdf": {
    label: "ICICI PDF",
    description:
      'Upload the "Statement of Transactions" PDF you can download from ICICI Bank\'s net banking or mobile app for a savings/current account.',
    preview: previewIciciPdfImport,
    confirm: confirmIciciPdfImport,
  },
  "icici-cc-pdf": {
    label: "ICICI CC PDF",
    description: 'Upload the "View Last Statement" PDF for an ICICI Bank credit card.',
    preview: previewIciciCcPdfImport,
    confirm: confirmIciciCcPdfImport,
  },
  "hdfc-cc-pdf": {
    label: "HDFC CC PDF",
    description: "Upload an HDFC Bank credit card statement PDF.",
    preview: previewHdfcCcPdfImport,
    confirm: confirmHdfcCcPdfImport,
  },
  "indmoney-pdf": {
    label: "IndMoney PDF",
    description:
      'Upload the "Account Statement" PDF you can download per-account from IndMoney. Includes the bank\'s full transaction narration, unlike the app screen\'s JSON.',
    preview: previewIndmoneyPdfImport,
    confirm: confirmIndmoneyPdfImport,
  },
} satisfies Record<
  string,
  {
    label: string;
    description: string;
    preview: (accountId: string, payload: { filename: string; data: string }) => Promise<IndmoneyPreview>;
    confirm: (
      accountId: string,
      payload: { filename: string; data: string; groupId: string; applyRules: boolean }
    ) => Promise<ImportResult>;
  }
>;
type PdfSourceKey = keyof typeof PDF_SOURCES;

type Source = "csv" | "indmoney" | PdfSourceKey;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // dataURL looks like "data:<mime>;base64,<data>" - only the part after
      // the comma is the actual base64 payload the server expects.
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
type Mode = "select" | "map" | "indmoney-review" | "done";

// Client-side mirror of the server's ambiguous-date interpretation, purely
// so the mapping step can show "this is how we'll read your first row" next
// to the date format picker - the actual import still parses server-side.
function previewDateInterpretation(raw: string | undefined, dateFormat: DateFormat): string | null {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!match) return null;
  const [, a, b, yRaw] = match;
  const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
  const [d, m] = dateFormat === "MDY" ? [b, a] : [a, b];
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function ImportWizard({ accountId, groups, onClose }: { accountId: string; groups: Group[]; onClose: () => void }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("select");
  const [filename, setFilename] = useState("");
  const [fileContent, setFileContent] = useState<string | undefined>(undefined);
  const [fileData, setFileData] = useState<string | undefined>(undefined);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [amountMode, setAmountMode] = useState<"single" | "debitCredit">("debitCredit");
  const [dateColumn, setDateColumn] = useState("");
  const [descriptionColumn, setDescriptionColumn] = useState("");
  const [amountColumn, setAmountColumn] = useState("");
  const [debitColumn, setDebitColumn] = useState("");
  const [creditColumn, setCreditColumn] = useState("");
  const [dateFormat, setDateFormat] = useState<DateFormat>("DMY");
  const [groupId, setGroupId] = useState(groups.find((g) => g.isDefault)?.id ?? groups[0]?.id ?? "");
  const [applyRules, setApplyRules] = useState(true);
  const [usingSavedMapping, setUsingSavedMapping] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source>("csv");
  const [indmoneyJsonText, setIndmoneyJsonText] = useState("");
  const [indmoneyPreview, setIndmoneyPreview] = useState<IndmoneyPreview | null>(null);
  const [pdfFile, setPdfFile] = useState<{ filename: string; data: string } | null>(null);

  const applyMapping = (mapping: {
    dateColumn: string | null;
    descriptionColumn: string | null;
    debitColumn?: string | null;
    creditColumn?: string | null;
    amountColumn?: string | null;
    dateFormat?: DateFormat;
  }) => {
    setDateColumn(mapping.dateColumn ?? "");
    setDescriptionColumn(mapping.descriptionColumn ?? "");
    if (mapping.debitColumn || mapping.creditColumn) {
      setAmountMode("debitCredit");
      setDebitColumn(mapping.debitColumn ?? "");
      setCreditColumn(mapping.creditColumn ?? "");
    } else {
      setAmountMode("single");
      setAmountColumn(mapping.amountColumn ?? "");
    }
    if (mapping.dateFormat) setDateFormat(mapping.dateFormat);
  };

  const isSpreadsheet = (name: string) => /\.(xlsx|xls)$/i.test(name);

  const handleFile = async (file: File) => {
    setError("");
    setLoading(true);
    try {
      setFilename(file.name);
      const file_ = isSpreadsheet(file.name)
        ? { data: await readFileAsBase64(file) }
        : { fileContent: await file.text() };
      setFileContent(file_.fileContent);
      setFileData(file_.data);
      const p = await previewImport(accountId, file_, file.name);
      setPreview(p);
      if (p.savedMapping) {
        applyMapping(p.savedMapping);
        // Older saved mappings (from before date-format detection existed)
        // won't have this field - fall back to the fresh auto-detection.
        if (!p.savedMapping.dateFormat) setDateFormat(p.suggestedDateFormat);
        setUsingSavedMapping(true);
      } else {
        applyMapping(p.suggestedMapping);
        setDateFormat(p.suggestedDateFormat);
        setUsingSavedMapping(false);
      }
      if (p.savedGroupId) setGroupId(p.savedGroupId);
      setMode("map");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not read this file");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const mapping: ColumnMapping =
        amountMode === "single"
          ? { dateColumn, descriptionColumn, amountColumn, dateFormat }
          : { dateColumn, descriptionColumn, debitColumn, creditColumn, dateFormat };
      const res = await confirmImport(accountId, { fileContent, data: fileData, filename, mapping, groupId, applyRules });
      setResult(res);
      setMode("done");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const parseIndmoneyJson = async () => {
    setError("");
    setLoading(true);
    try {
      const p = await previewIndmoneyImport(accountId, indmoneyJsonText);
      setIndmoneyPreview(p);
      if (p.groups.some((g) => g.id === groupId)) {
        // keep current selection if still valid
      } else {
        setGroupId(p.groups.find((g) => g.isDefault)?.id ?? p.groups[0]?.id ?? "");
      }
      setMode("indmoney-review");
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const isPdfSource = (s: Source): s is PdfSourceKey => s in PDF_SOURCES;

  const handlePdfFile = async (file: File) => {
    if (!isPdfSource(source)) return;
    setError("");
    setLoading(true);
    try {
      const data = await readFileAsBase64(file);
      const p = await PDF_SOURCES[source].preview(accountId, { filename: file.name, data });
      setPdfFile({ filename: file.name, data });
      setIndmoneyPreview(p);
      if (!p.groups.some((g) => g.id === groupId)) {
        setGroupId(p.groups.find((g) => g.isDefault)?.id ?? p.groups[0]?.id ?? "");
      }
      setMode("indmoney-review");
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const submitIndmoney = async () => {
    setError("");
    setLoading(true);
    try {
      const res =
        isPdfSource(source) && pdfFile
          ? await PDF_SOURCES[source].confirm(accountId, { ...pdfFile, groupId, applyRules })
          : await confirmIndmoneyImport(accountId, { jsonText: indmoneyJsonText, groupId, applyRules });
      setResult(res);
      setMode("done");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Import statement" onClose={onClose} wide>
      {mode === "select" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap justify-center gap-1 rounded-lg bg-black/5 p-1 dark:bg-white/5">
            <button
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                source === "csv" ? "bg-brand text-white" : "text-ink-secondary hover:text-ink"
              }`}
              onClick={() => {
                setSource("csv");
                setError("");
              }}
            >
              Bank CSV
            </button>
            {(Object.keys(PDF_SOURCES) as PdfSourceKey[]).map((key) => (
              <button
                key={key}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  source === key ? "bg-brand text-white" : "text-ink-secondary hover:text-ink"
                }`}
                onClick={() => {
                  setSource(key);
                  setError("");
                }}
              >
                {PDF_SOURCES[key].label}
              </button>
            ))}
            <button
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                source === "indmoney" ? "bg-brand text-white" : "text-ink-secondary hover:text-ink"
              }`}
              onClick={() => {
                setSource("indmoney");
                setError("");
              }}
            >
              IndMoney JSON
            </button>
          </div>
          <p className="text-center text-xs text-ink-muted">
            "IndMoney" here means the IndMoney investing app specifically - only pick those two if that's where your
            statement is coming from.
          </p>

          {isPdfSource(source) ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <p className="text-sm text-ink-secondary">{PDF_SOURCES[source].description}</p>
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handlePdfFile(e.target.files[0])}
              />
              <Button onClick={() => pdfInputRef.current?.click()} disabled={loading}>
                {loading ? "Reading PDF…" : "Choose PDF statement"}
              </Button>
            </div>
          ) : source === "csv" ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <p className="text-sm text-ink-secondary">
                Upload a CSV or Excel (.xlsx/.xls) export of your bank or credit card statement. Works with common
                formats (Date/Narration/Debit/Credit, or Date/Description/Amount).
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <Button onClick={() => fileInputRef.current?.click()} disabled={loading}>
                {loading ? "Reading file…" : "Choose CSV or Excel file"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 py-4">
              <p className="text-sm text-ink-secondary">
                Paste the JSON from IndMoney's Account Aggregator "All Transactions" screen (copied from your browser's
                network tab). No column mapping needed - dates, merchants, and amounts are read directly.
              </p>
              <textarea
                value={indmoneyJsonText}
                onChange={(e) => setIndmoneyJsonText(e.target.value)}
                placeholder='{"data": {"transaction_list": [...]}}'
                rows={8}
                className="w-full rounded-lg border border-hairline-strong bg-white/[0.03] px-3 py-2 font-mono text-xs text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
              />
              <Button onClick={parseIndmoneyJson} disabled={loading || !indmoneyJsonText.trim()} className="self-start">
                {loading ? "Parsing…" : "Parse JSON"}
              </Button>
            </div>
          )}

          {error && <p className="text-center text-sm text-critical">{error}</p>}
        </div>
      )}

      {mode === "indmoney-review" && indmoneyPreview && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-muted">
            {indmoneyPreview.parsedCount} transaction(s) found
            {indmoneyPreview.invalidCount > 0 && `, ${indmoneyPreview.invalidCount} couldn't be read`}. Review a sample below,
            then confirm.
          </p>

          <div>
            <Label>Assign transactions to group</Label>
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              {indmoneyPreview.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <input type="checkbox" checked={applyRules} onChange={(e) => setApplyRules(e.target.checked)} className="h-4 w-4 accent-brand" />
            Auto-categorize using my rules
          </label>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-hairline">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-white/5">
                <tr>
                  <th className="px-2 py-1 text-left font-medium text-ink-muted">Date</th>
                  <th className="px-2 py-1 text-left font-medium text-ink-muted">Description</th>
                  <th className="px-2 py-1 text-right font-medium text-ink-muted">Amount</th>
                </tr>
              </thead>
              <tbody>
                {indmoneyPreview.sampleRows.map((row, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-hairline">
                    <td className="px-2 py-1 text-ink-secondary">{formatDate(row.dateISO)}</td>
                    <td className="px-2 py-1 text-ink-secondary">{row.description}</td>
                    <td className={`px-2 py-1 text-right ${row.amount >= 0 ? "text-good" : "text-ink-secondary"}`}>
                      {formatMoney(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && <p className="text-sm text-critical">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMode("select")}>
              Back
            </Button>
            <Button onClick={submitIndmoney} disabled={loading || !groupId}>
              {loading ? "Importing…" : "Import"}
            </Button>
          </div>
        </div>
      )}

      {mode === "map" && preview && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-muted">
            {preview.rowCount} row(s) detected in {filename}. Confirm the column mapping below.
          </p>

          {usingSavedMapping ? (
            <div className="flex items-center justify-between rounded-lg bg-brand/10 px-3 py-2 text-xs text-brand">
              <span>Using the mapping you last used for this account.</span>
              <button
                className="font-medium underline"
                onClick={() => {
                  applyMapping(preview.suggestedMapping);
                  setDateFormat(preview.suggestedDateFormat);
                  setUsingSavedMapping(false);
                }}
              >
                Reset to auto-detected
              </button>
            </div>
          ) : preview.savedMapping ? (
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-muted dark:bg-white/5 dark:text-ink-muted">
              <span>Using auto-detected columns.</span>
              <button
                className="font-medium text-brand underline"
                onClick={() => {
                  applyMapping(preview.savedMapping!);
                  if (!preview.savedMapping!.dateFormat) setDateFormat(preview.suggestedDateFormat);
                  setUsingSavedMapping(true);
                  if (preview.savedGroupId) setGroupId(preview.savedGroupId);
                }}
              >
                Use last saved mapping instead
              </button>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date column</Label>
              <Select value={dateColumn} onChange={(e) => setDateColumn(e.target.value)}>
                {preview.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Description column</Label>
              <Select value={descriptionColumn} onChange={(e) => setDescriptionColumn(e.target.value)}>
                {preview.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label>Date format (which position is the day?)</Label>
            <Select value={dateFormat} onChange={(e) => setDateFormat(e.target.value as DateFormat)}>
              <option value="DMY">DD/MM/YYYY - day first (e.g. India, UK)</option>
              <option value="MDY">MM/DD/YYYY - month first (e.g. US)</option>
              <option value="YMD">YYYY-MM-DD - year first (ISO)</option>
            </Select>
            {(() => {
              const example = previewDateInterpretation(preview.sampleRows[0]?.[dateColumn], dateFormat);
              return example ? (
                <p className="mt-1 text-xs text-ink-muted">
                  First row will be read as <span className="font-medium text-ink-secondary">{example}</span> - check
                  this matches your statement before importing.
                </p>
              ) : null;
            })()}
          </div>

          <div>
            <Label>Amount format</Label>
            <Select value={amountMode} onChange={(e) => setAmountMode(e.target.value as "single" | "debitCredit")}>
              <option value="debitCredit">Separate debit/withdrawal &amp; credit/deposit columns</option>
              <option value="single">Single signed amount column</option>
            </Select>
          </div>

          {amountMode === "debitCredit" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Debit / withdrawal column</Label>
                <Select value={debitColumn} onChange={(e) => setDebitColumn(e.target.value)}>
                  <option value="">(none)</option>
                  {preview.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Credit / deposit column</Label>
                <Select value={creditColumn} onChange={(e) => setCreditColumn(e.target.value)}>
                  <option value="">(none)</option>
                  {preview.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          ) : (
            <div>
              <Label>Amount column</Label>
              <Select value={amountColumn} onChange={(e) => setAmountColumn(e.target.value)}>
                {preview.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <Label>Assign transactions to group</Label>
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <input type="checkbox" checked={applyRules} onChange={(e) => setApplyRules(e.target.checked)} className="h-4 w-4 accent-brand" />
            Auto-categorize using my rules
          </label>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-hairline">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-white/5">
                <tr>
                  {preview.headers.map((h) => (
                    <th key={h} className="px-2 py-1 text-left font-medium text-ink-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sampleRows.map((row, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-hairline">
                    {preview.headers.map((h) => (
                      <td key={h} className="px-2 py-1 text-ink-secondary">
                        {row[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && <p className="text-sm text-critical">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMode("select")}>
              Back
            </Button>
            <Button onClick={submit} disabled={loading || !dateColumn || !descriptionColumn || !groupId}>
              {loading ? "Importing…" : "Import"}
            </Button>
          </div>
        </div>
      )}

      {mode === "done" && result && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-lg font-semibold text-ink">Import complete</p>
          <p className="text-sm text-ink-secondary">
            Added {result.created} new transaction(s). Skipped {result.skipped} duplicate(s) out of {result.total} rows.
          </p>
          {result.invalidRowCount > 0 && (
            <div className="w-full rounded-lg bg-critical/10 px-3 py-2 text-left text-xs text-critical">
              <p className="font-medium">
                {result.invalidRowCount} row(s) couldn't be read and were skipped (unparseable date or missing description).
              </p>
              {result.invalidSamples.length > 0 && (
                <ul className="mt-1 space-y-0.5 font-mono">
                  {result.invalidSamples.map((s) => (
                    <li key={s.rowIndex}>
                      Row {s.rowIndex + 1}: date="{s.dateRaw}" description="{s.descriptionRaw}" ({s.reason.replace("_", " ")})
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1">Check the date format and column mapping if this looks wrong, then re-import.</p>
            </div>
          )}
          <Button onClick={onClose}>Done</Button>
        </div>
      )}
    </Modal>
  );
}
