"use client";

import { uploadPresigned } from "@vercel/blob/client";
import { useState, useTransition } from "react";
import type { ActionState } from "@/components/action-form";
import { button, Field, input } from "@/components/ui";
import {
  DIRECT_UPLOAD_LIMIT,
  documentFileProblem,
  documentStorageKey,
  formatBytes,
  safeFileName,
  SERVER_UPLOAD_LIMIT,
} from "@/lib/files";
import {
  addDocumentAction,
  addUploadedDocumentAction,
  replaceDocumentAction,
  replaceWithUploadedDocumentAction,
} from "../../actions";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
const MULTIPART_ABOVE = 16 * 1024 * 1024;

/** Puts a large file straight into Blob storage and returns its key. */
async function uploadDirect(lotId: string, file: File, onProgress: (percent: number) => void): Promise<string> {
  const key = documentStorageKey(lotId, safeFileName(file.name, file.type), crypto.randomUUID());
  await uploadPresigned(key, file, {
    access: "private",
    handleUploadUrl: "/api/admin/uploads",
    clientPayload: JSON.stringify({ lotId }),
    contentType: file.type,
    multipart: file.size > MULTIPART_ABOVE,
    onUploadProgress: ({ percentage }) => onProgress(Math.round(percentage)),
  });
  return key;
}

/**
 * Files up to 4 MB go through a server action, as they always have. Larger
 * ones, when direct uploads are set up, go from the browser to storage first
 * and are recorded after; otherwise they're refused before anything is sent.
 */
function useDocumentUpload(lotId: string, directUploads: boolean) {
  const [state, setState] = useState<ActionState>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const limit = directUploads ? DIRECT_UPLOAD_LIMIT : SERVER_UPLOAD_LIMIT;

  function submit(
    form: HTMLFormElement,
    viaServer: (formData: FormData) => Promise<ActionState>,
    viaStorage: (storageKey: string, formData: FormData) => Promise<ActionState>,
  ) {
    const formData = new FormData(form);
    const picked = formData.get("file");
    const file = picked instanceof File ? picked : null;
    const problem = documentFileProblem(file, limit);
    if (problem || !file) {
      setState({ error: problem ?? "Choose a file to upload." });
      return;
    }
    setState(null);
    startTransition(async () => {
      let result: ActionState;
      if (file.size > SERVER_UPLOAD_LIMIT) {
        try {
          setProgress(0);
          result = await viaStorage(await uploadDirect(lotId, file, setProgress), formData);
        } catch (error) {
          console.error("Direct upload failed:", error);
          result = { error: "The upload didn't finish. Check your connection and try again." };
        } finally {
          setProgress(null);
        }
      } else {
        result = await viaServer(formData);
      }
      setState(result);
      if (result?.ok) form.reset();
    });
  }

  return { state, progress, pending, limit, submit };
}

function UploadStatus({ state, progress }: { state: ActionState; progress: number | null }) {
  return (
    <>
      {progress !== null ? (
        <div aria-live="polite" className="text-xs text-slate-600">
          Uploading… {progress}%
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-ink transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}
      {state?.error ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state?.message ? (
        <p role="status" className="text-sm text-emerald-800">
          {state.message}
        </p>
      ) : null}
    </>
  );
}

export function AddDocumentForm({
  lotId,
  directUploads,
  types,
}: {
  lotId: string;
  directUploads: boolean;
  types: { value: string; label: string }[];
}) {
  const upload = useDocumentUpload(lotId, directUploads);
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        upload.submit(
          event.currentTarget,
          (formData) => addDocumentAction(lotId, null, formData),
          (storageKey, formData) =>
            addUploadedDocumentAction(lotId, {
              type: String(formData.get("type") ?? ""),
              title: String(formData.get("title") ?? ""),
              storageKey,
            }),
        );
      }}
    >
      <Field label="Type" name="type" required>
        <select id="type" name="type" required defaultValue="" className={input}>
          <option value="" disabled>
            Choose a type
          </option>
          {types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Title customers see" name="title" required>
        <input id="title" name="title" required className={input} placeholder="Certificate of Analysis" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="File" name="file" required hint={`PDF, PNG or JPEG, up to ${formatBytes(upload.limit)}.`}>
          <input id="file" name="file" type="file" required accept={ACCEPT} className="block w-full text-sm" />
        </Field>
      </div>
      <div className="space-y-3 sm:col-span-2">
        <button type="submit" disabled={upload.pending} className={button.primary}>
          {upload.pending ? "Uploading…" : "Upload"}
        </button>
        <UploadStatus state={upload.state} progress={upload.progress} />
      </div>
    </form>
  );
}

export function ReplaceDocumentForm({
  documentId,
  lotId,
  directUploads,
}: {
  documentId: string;
  lotId: string;
  directUploads: boolean;
}) {
  const upload = useDocumentUpload(lotId, directUploads);
  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        upload.submit(
          event.currentTarget,
          (formData) => replaceDocumentAction(documentId, lotId, null, formData),
          (storageKey, formData) =>
            replaceWithUploadedDocumentAction(documentId, lotId, {
              reason: String(formData.get("reason") ?? ""),
              storageKey,
            }),
        );
      }}
    >
      <input name="file" type="file" required accept={ACCEPT} className="block w-full text-xs" aria-label="New version" />
      <input name="reason" required placeholder="Reason for the new version" className={input} aria-label="Reason" />
      <button type="submit" disabled={upload.pending} className={button.secondary}>
        {upload.pending ? "Uploading…" : "Upload new version"}
      </button>
      <UploadStatus state={upload.state} progress={upload.progress} />
    </form>
  );
}
