import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportExport } from "../../src/options/ImportExport";
import { getRules } from "../../src/storage/store";
import type { RuleExport } from "../../src/types/rules";

// jsdom doesn't implement object-URL APIs; stub them so the export download path
// (Blob -> anchor.click) runs without throwing.
vi.stubGlobal("URL", {
  ...URL,
  createObjectURL: vi.fn(() => "blob:mock"),
  revokeObjectURL: vi.fn(),
});

function makeFile(contents: string, name = "rules.json"): File {
  return new File([contents], name, { type: "application/json" });
}

const validEnvelope: RuleExport = {
  version: 1,
  exportedAt: Date.now(),
  rules: [
    {
      id: "ignored",
      name: "imported block",
      type: "block",
      enabled: true,
      condition: { urlFilter: "||ads.test" },
      createdAt: 0,
      updatedAt: 0,
    },
  ],
  groups: [],
};

beforeEach(async () => {
  await chrome.storage.local.clear();
});

describe("ImportExport", () => {
  it("imports rules from a valid JSON file", async () => {
    const reload = async () => undefined;
    render(<ImportExport reload={reload} />);

    const input = screen.getByLabelText("Import rules file") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile(JSON.stringify(validEnvelope))] } });

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Imported 1 rule(s)."),
    );
    const rules = await getRules();
    expect(rules).toHaveLength(1);
    expect(rules[0].name).toBe("imported block");
  });

  it("shows an error for malformed JSON", async () => {
    render(<ImportExport reload={async () => undefined} />);
    const input = screen.getByLabelText("Import rules file") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("{ not json ")] } });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Could not parse JSON file."),
    );
    expect(await getRules()).toHaveLength(0);
  });

  it("shows an error for an unsupported export version", async () => {
    render(<ImportExport reload={async () => undefined} />);
    const input = screen.getByLabelText("Import rules file") as HTMLInputElement;
    const bad = JSON.stringify({ version: 2, exportedAt: 0, rules: [], groups: [] });
    fireEvent.change(input, { target: { files: [makeFile(bad)] } });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/unsupported export version/),
    );
  });

  it("exports without throwing and reports a count", async () => {
    render(<ImportExport reload={async () => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Exported 0 rule/));
  });
});
