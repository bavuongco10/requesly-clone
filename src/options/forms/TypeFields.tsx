// Per-type fields for the rule form. Switches on the draft's rule type and
// renders only the inputs relevant to that type. `block` has no extra fields.

import type { RuleDraft } from "../draft";
import { HeaderOpsEditor } from "./HeaderOpsEditor";

interface TypeFieldsProps {
  draft: RuleDraft;
  onChange: (patch: Partial<RuleDraft>) => void;
}

const inputCls = "rounded border border-gray-300 px-2 py-1";
const labelCls = "flex flex-col gap-1 text-sm";

export function TypeFields({ draft, onChange }: TypeFieldsProps) {
  switch (draft.type) {
    case "redirect":
      return (
        <div className="flex flex-col gap-3">
          <label className={labelCls}>
            <span className="text-gray-600">Redirect to URL</span>
            <input
              type="text"
              aria-label="Redirect URL"
              placeholder="https://destination.test/"
              value={draft.redirectUrl}
              onChange={(e) => onChange({ redirectUrl: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            <span className="text-gray-600">Regex substitution (needs a regex filter)</span>
            <input
              type="text"
              aria-label="Regex substitution"
              placeholder="https://destination.test/\\1"
              value={draft.regexSubstitution}
              onChange={(e) => onChange({ regexSubstitution: e.target.value })}
              className={`${inputCls} font-mono`}
            />
          </label>
        </div>
      );

    case "modifyHeaders":
      return (
        <div className="flex flex-col gap-3">
          <HeaderOpsEditor
            label="Request headers"
            ops={draft.requestHeaders}
            onChange={(requestHeaders) => onChange({ requestHeaders })}
          />
          <HeaderOpsEditor
            label="Response headers"
            ops={draft.responseHeaders}
            onChange={(responseHeaders) => onChange({ responseHeaders })}
          />
        </div>
      );

    case "block":
      return (
        <p className="text-sm text-gray-500">
          Matching requests will be blocked. No extra configuration needed.
        </p>
      );

    case "replace":
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelCls}>
            <span className="text-gray-600">Find (from)</span>
            <input
              type="text"
              aria-label="Replace from"
              placeholder="http://"
              value={draft.from}
              onChange={(e) => onChange({ from: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            <span className="text-gray-600">Replace with (to)</span>
            <input
              type="text"
              aria-label="Replace to"
              placeholder="https://"
              value={draft.to}
              onChange={(e) => onChange({ to: e.target.value })}
              className={inputCls}
            />
          </label>
        </div>
      );

    case "mock":
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelCls}>
              <span className="text-gray-600">Status code</span>
              <input
                type="number"
                aria-label="Mock status code"
                value={draft.statusCode}
                onChange={(e) => onChange({ statusCode: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className={labelCls}>
              <span className="text-gray-600">Content-Type</span>
              <input
                type="text"
                aria-label="Mock content type"
                value={draft.contentType}
                onChange={(e) => onChange({ contentType: e.target.value })}
                className={inputCls}
              />
            </label>
          </div>
          <label className={labelCls}>
            <span className="text-gray-600">Response body</span>
            <textarea
              aria-label="Mock body"
              rows={6}
              value={draft.body}
              onChange={(e) => onChange({ body: e.target.value })}
              className={`${inputCls} font-mono`}
            />
          </label>
        </div>
      );

    case "inject":
      return (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <label className={labelCls}>
              <span className="text-gray-600">Language</span>
              <select
                aria-label="Injection language"
                value={draft.language}
                onChange={(e) => onChange({ language: e.target.value as "js" | "css" })}
                className={inputCls}
              >
                <option value="js">JavaScript</option>
                <option value="css">CSS</option>
              </select>
            </label>
            <label className={labelCls}>
              <span className="text-gray-600">Run at</span>
              <select
                aria-label="Injection run at"
                value={draft.runAt}
                onChange={(e) => onChange({ runAt: e.target.value as RuleDraft["runAt"] })}
                className={inputCls}
              >
                <option value="document_start">document_start</option>
                <option value="document_end">document_end</option>
                <option value="document_idle">document_idle</option>
              </select>
            </label>
          </div>
          <label className={labelCls}>
            <span className="text-gray-600">Code</span>
            <textarea
              aria-label="Injection code"
              rows={8}
              value={draft.code}
              onChange={(e) => onChange({ code: e.target.value })}
              className={`${inputCls} font-mono`}
            />
          </label>
        </div>
      );

    default:
      return null;
  }
}
