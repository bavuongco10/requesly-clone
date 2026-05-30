import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Popup } from "../../src/popup/Popup";
import { addRule, getRules } from "../../src/storage/store";
import type { BlockRule } from "../../src/types/rules";

function block(name: string, enabled = true) {
  return {
    name,
    type: "block",
    enabled,
    condition: { urlFilter: `||${name}.test` },
  } as Omit<BlockRule, "id" | "createdAt" | "updatedAt">;
}

beforeEach(async () => {
  await chrome.storage.local.clear();
});

describe("Popup", () => {
  it("shows the empty state when there are no rules", async () => {
    render(<Popup />);
    await waitFor(() => expect(screen.getByText("No rules yet.")).toBeInTheDocument());
  });

  it("lists rules and shows the active count", async () => {
    await addRule(block("a", true));
    await addRule(block("b", false));
    render(<Popup />);
    await waitFor(() => expect(screen.getByText("a")).toBeInTheDocument());
    expect(screen.getByText("b")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 rules active")).toBeInTheDocument();
  });

  it("toggles a rule when its switch is clicked", async () => {
    await addRule(block("a", true));
    render(<Popup />);
    const toggle = await screen.findByRole("button", { name: "Toggle a" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggle);
    await waitFor(async () => {
      const rules = await getRules();
      expect(rules[0].enabled).toBe(false);
    });
  });
});
