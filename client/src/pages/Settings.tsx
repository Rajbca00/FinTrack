import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Card, Button } from "../components/ui";
import { exportData, importData, getErrorMessage } from "../lib/api";

export function Settings() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    setError("");
    try {
      const payload = await exportData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `fintrack-backup-${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Export downloaded.");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const handleImportFile = async (file: File) => {
    if (
      !confirm(
        "Restoring a backup replaces ALL current data (accounts, transactions, everything) with what's in this file. This can't be undone. Continue?"
      )
    ) {
      return;
    }
    setImporting(true);
    setError("");
    setMessage("");
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      await importData(payload);
      setMessage("Backup restored. Reloading…");
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-ink">Settings</h1>
        <p className="text-sm text-ink-muted">Manage your data and app configuration.</p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-secondary">Categories & Import Rules</h2>
        <Card className="flex items-center justify-between">
          <p className="text-sm text-ink-secondary">Manage categories and auto-categorization rules.</p>
          <Link to="/categories">
            <Button variant="secondary">Open →</Button>
          </Link>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-secondary">Backup & Export</h2>
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Export all data</p>
              <p className="text-xs text-ink-muted">
                Download every account, transaction, asset, goal, and budget as a single JSON file.
              </p>
            </div>
            <Button variant="secondary" onClick={handleExport} disabled={exporting}>
              {exporting ? "Exporting…" : "Export data"}
            </Button>
          </div>
          <div className="flex flex-col gap-2 border-t border-hairline pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Restore from backup</p>
              <p className="text-xs text-critical">
                Replaces all current data with the contents of the file. This can't be undone.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportFile(file);
                e.target.value = "";
              }}
            />
            <Button variant="danger" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? "Restoring…" : "Restore backup…"}
            </Button>
          </div>
          {message && <p className="text-xs text-good">{message}</p>}
          {error && <p className="text-xs text-critical">{error}</p>}
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-secondary">Security</h2>
        <Card>
          <p className="text-sm text-ink-secondary">
            This app is protected by HTTP Basic Auth at the server level (configured via environment variables), since
            it's a personal deployment reachable at a public URL.
          </p>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-secondary">Appearance</h2>
        <Card>
          <p className="text-sm text-ink-secondary">
            FinTrack uses a single dark theme by design - there's no light mode to switch to.
          </p>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-secondary">About</h2>
        <Card>
          <p className="text-sm font-medium text-ink">FinTrack</p>
          <p className="text-xs text-ink-muted">Personal finance manager - accounts, budgets, goals, and net worth in one place.</p>
        </Card>
      </div>
    </div>
  );
}
