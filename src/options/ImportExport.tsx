// Import / export of all rules + groups as JSON.
//
// Export builds the envelope from the storage layer and triggers a browser
// download via a Blob + temporary anchor. Import reads a chosen .json file,
// parses it, and hands it to `importAll`, which validates the envelope (and
// throws on a bad version / malformed shape). We surface the imported count or
// the error message.

import { useRef, useState } from "react";
import { exportAll, importAll } from "../storage/store";
import type { RuleExport } from "../types/rules";

interface ImportExportProps {
  reload: () => Promise<void> | void;
}

type Status =
  | { kind: "idle" }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

/** Read a File as text via FileReader (works in browsers and jsdom alike). */
function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsText(file);
  });
}

export function ImportExport({ reload }: ImportExportProps) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);

  const onExport = async () => {
    try {
      const data = await exportAll();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `requestly-clone-rules-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatus({ kind: "ok", message: `Exported ${data.rules.length} rule(s).` });
    } catch (e) {
      setStatus({ kind: "error", message: e instanceof Error ? e.message : "Export failed." });
    }
  };

  const onImportFile = async (file: File) => {
    try {
      const text = await readFileText(file);
      const parsed = JSON.parse(text) as RuleExport;
      const count = await importAll(parsed);
      await reload();
      setStatus({ kind: "ok", message: `Imported ${count} rule(s).` });
    } catch (e) {
      const message =
        e instanceof SyntaxError
          ? "Could not parse JSON file."
          : e instanceof Error
            ? e.message
            : "Import failed.";
      setStatus({ kind: "error", message });
    } finally {
      // Allow re-selecting the same file again.
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section
      aria-label="Import and export"
      className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
    >
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Import / Export</h2>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onExport}
          className="rounded border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Export JSON
        </button>
        <label className="rounded border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
          Import JSON
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            aria-label="Import rules file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImportFile(file);
            }}
          />
        </label>
      </div>
      {status.kind !== "idle" ? (
        <p
          role={status.kind === "error" ? "alert" : "status"}
          className={`text-sm font-medium ${
            status.kind === "error"
              ? "text-red-600 dark:text-red-400"
              : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {status.message}
        </p>
      ) : null}
    </section>
  );
}
