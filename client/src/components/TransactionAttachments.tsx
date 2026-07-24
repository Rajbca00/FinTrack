import { useRef, useState } from "react";
import { useAttachments, useUploadAttachment, useDeleteAttachment } from "../hooks/useApi";
import { getAttachment } from "../lib/api";
import { Button, Label } from "./ui";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // dataURL looks like "data:<mime>;base64,<data>" - only the part
      // after the comma is the actual base64 payload the server stores.
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Receipts, invoices, warranties, photos, PDFs - attached to a transaction
// for reimbursements and audits. Files are read client-side and posted as
// base64 (see MAX_ATTACHMENT_BYTES, mirrored server-side), then opened for
// viewing/downloading via a fetched data: URL rather than a persistent link,
// since nothing here is served from a real file host.
export function TransactionAttachments({ transactionId }: { transactionId: string }) {
  const { data: attachments } = useAttachments(transactionId);
  const upload = useUploadAttachment(transactionId);
  const remove = useDeleteAttachment(transactionId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError("");
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError(`File too large (max ${MAX_ATTACHMENT_BYTES / (1024 * 1024)}MB)`);
      return;
    }
    const data = await readFileAsBase64(file);
    upload.mutate(
      { filename: file.name, mimeType: file.type || "application/octet-stream", data },
      { onError: () => setError("Upload failed") }
    );
  };

  const openAttachment = async (id: string) => {
    setOpeningId(id);
    try {
      const full = await getAttachment(id);
      const win = window.open();
      if (win) {
        win.document.write(
          `<iframe src="data:${full.mimeType};base64,${full.data}" style="border:0;width:100%;height:100vh"></iframe>`
        );
      }
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div>
      <Label>Attachments</Label>
      <div className="flex flex-col gap-2">
        {attachments?.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-hairline px-3 py-2 text-sm">
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left text-ink-secondary hover:text-brand disabled:opacity-50"
              onClick={() => openAttachment(a.id)}
              disabled={openingId === a.id}
            >
              {a.filename}
            </button>
            <span className="shrink-0 text-xs text-ink-muted">{formatSize(a.size)}</span>
            <button
              type="button"
              className="shrink-0 text-xs text-ink-muted hover:text-critical"
              onClick={() => remove.mutate(a.id)}
            >
              Remove
            </button>
          </div>
        ))}
        {(attachments?.length ?? 0) === 0 && <p className="text-xs text-ink-muted">No files attached.</p>}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <Button variant="secondary" className="mt-2" onClick={() => fileInputRef.current?.click()} disabled={upload.isPending}>
        {upload.isPending ? "Uploading…" : "+ Attach file"}
      </Button>
      {error && <p className="mt-1 text-xs text-critical">{error}</p>}
    </div>
  );
}
