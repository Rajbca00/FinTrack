import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Card, Button, Modal, Input } from "../components/ui";
import { exportData, importData, resetApp, getErrorMessage } from "../lib/api";
import { useTheme } from "../hooks/useTheme";
import { THEMES } from "../lib/theme";

const RESET_PHRASE = "RESET";

export function Settings() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);
  const { theme, setTheme } = useTheme();

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
      // Safari (desktop and iOS) only reliably fires the download if the
      // anchor is actually in the DOM when clicked, and revoking the blob
      // URL in the same tick as click() can race ahead of the browser
      // starting the download - both silently no-op the export instead of
      // erroring, so the delay and appendChild are load-bearing, not cleanup.
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  const handleReset = async () => {
    setResetting(true);
    setError("");
    try {
      await resetApp();
      setShowResetModal(false);
      setMessage("App reset. Reloading…");
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setResetting(false);
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors ${
                  theme === t.id ? "border-brand ring-1 ring-brand" : "border-hairline hover:border-hairline-strong"
                }`}
              >
                <div className="flex overflow-hidden rounded-lg border border-hairline">
                  <div className="h-10 flex-1" style={{ background: t.swatch.page }} />
                  <div className="h-10 flex-1" style={{ background: t.swatch.surface }} />
                  <div className="h-10 flex-1" style={{ background: t.swatch.brand }} />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ink">{t.name}</p>
                  {theme === t.id && <span className="text-xs font-medium text-brand">Active</span>}
                </div>
                <p className="text-xs text-ink-muted">{t.description}</p>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-secondary">About</h2>
        <Card>
          <p className="text-sm font-medium text-ink">FinTrack</p>
          <p className="text-xs text-ink-muted">Personal finance manager - accounts, budgets, goals, and net worth in one place.</p>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-critical">Danger Zone</h2>
        <Card className="flex flex-col gap-2 border-critical/30 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-ink">Reset app</p>
            <p className="text-xs text-critical">
              Permanently deletes every account, transaction, and everything else, then restores the default
              categories. There's no undo - export a backup first if you want one.
            </p>
          </div>
          <Button
            variant="danger"
            onClick={() => {
              setResetConfirmText("");
              setError("");
              setShowResetModal(true);
            }}
          >
            Reset app…
          </Button>
        </Card>
      </div>

      {showResetModal && (
        <Modal title="Reset app?" onClose={() => setShowResetModal(false)}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-secondary">
              This permanently deletes every account, transaction, asset, goal, budget, and everything else in
              FinTrack, then restores the default categories and rules. <strong className="text-critical">This can't be undone.</strong>
            </p>
            <div>
              <p className="mb-1 text-xs font-medium text-ink-muted">
                Type <span className="font-mono text-ink">{RESET_PHRASE}</span> to confirm
              </p>
              <Input
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder={RESET_PHRASE}
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-critical">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowResetModal(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleReset} disabled={resetting || resetConfirmText !== RESET_PHRASE}>
                {resetting ? "Resetting…" : "Reset everything"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
