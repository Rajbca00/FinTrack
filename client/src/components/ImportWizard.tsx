import { useRef, useState } from "react";
import { Modal, Button, Select, Label } from "./ui";
import { previewImport, confirmImport, type ColumnMapping, type ImportPreview } from "../lib/api";
import type { Group } from "../lib/api";
import { useQueryClient } from "@tanstack/react-query";

type Mode = "select" | "map" | "done";

export function ImportWizard({ accountId, groups, onClose }: { accountId: string; groups: Group[]; onClose: () => void }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("select");
  const [filename, setFilename] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [amountMode, setAmountMode] = useState<"single" | "debitCredit">("debitCredit");
  const [dateColumn, setDateColumn] = useState("");
  const [descriptionColumn, setDescriptionColumn] = useState("");
  const [amountColumn, setAmountColumn] = useState("");
  const [debitColumn, setDebitColumn] = useState("");
  const [creditColumn, setCreditColumn] = useState("");
  const [groupId, setGroupId] = useState(groups.find((g) => g.isDefault)?.id ?? groups[0]?.id ?? "");
  const [applyRules, setApplyRules] = useState(true);
  const [result, setResult] = useState<{ created: number; skipped: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File) => {
    setError("");
    setLoading(true);
    try {
      const content = await file.text();
      setFilename(file.name);
      setFileContent(content);
      const p = await previewImport(accountId, content, file.name);
      setPreview(p);
      setDateColumn(p.suggestedMapping.dateColumn ?? "");
      setDescriptionColumn(p.suggestedMapping.descriptionColumn ?? "");
      if (p.suggestedMapping.debitColumn || p.suggestedMapping.creditColumn) {
        setAmountMode("debitCredit");
        setDebitColumn(p.suggestedMapping.debitColumn ?? "");
        setCreditColumn(p.suggestedMapping.creditColumn ?? "");
      } else {
        setAmountMode("single");
        setAmountColumn(p.suggestedMapping.amountColumn ?? "");
      }
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
          ? { dateColumn, descriptionColumn, amountColumn }
          : { dateColumn, descriptionColumn, debitColumn, creditColumn };
      const res = await confirmImport(accountId, { fileContent, filename, mapping, groupId, applyRules });
      setResult(res);
      setMode("done");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Import statement" onClose={onClose} wide>
      {mode === "select" && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Upload a CSV export of your bank or credit card statement. Works with common formats (Date/Narration/Debit/Credit,
            or Date/Description/Amount).
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={loading}>
            {loading ? "Reading file…" : "Choose CSV file"}
          </Button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {mode === "map" && preview && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {preview.rowCount} row(s) detected in {filename}. Confirm the column mapping below.
          </p>

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

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={applyRules} onChange={(e) => setApplyRules(e.target.checked)} />
            Auto-categorize using my rules
          </label>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  {preview.headers.map((h) => (
                    <th key={h} className="px-2 py-1 text-left font-medium text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sampleRows.map((row, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                    {preview.headers.map((h) => (
                      <td key={h} className="px-2 py-1 text-slate-600 dark:text-slate-300">
                        {row[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

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
          <p className="text-lg font-semibold text-slate-900 dark:text-white">Import complete</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Added {result.created} new transaction(s). Skipped {result.skipped} duplicate(s) out of {result.total} rows.
          </p>
          <Button onClick={onClose}>Done</Button>
        </div>
      )}
    </Modal>
  );
}
