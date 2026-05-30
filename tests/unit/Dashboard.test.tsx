import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Dashboard } from "../../src/options/Dashboard";
import { addRule, getRules } from "../../src/storage/store";
import type { BlockRule, RedirectRule } from "../../src/types/rules";

function redirect(name: string, urlFilter: string) {
  return {
    name,
    type: "redirect",
    enabled: true,
    condition: { urlFilter },
    redirect: { url: "https://dest.test/" },
  } as Omit<RedirectRule, "id" | "createdAt" | "updatedAt">;
}

function block(name: string) {
  return {
    name,
    type: "block",
    enabled: true,
    condition: { urlFilter: `||${name}.test` },
  } as Omit<BlockRule, "id" | "createdAt" | "updatedAt">;
}

beforeEach(async () => {
  await chrome.storage.local.clear();
});

describe("Dashboard", () => {
  it("renders the rule list from storage", async () => {
    await addRule(redirect("alpha", "||alpha.test/api"));
    await addRule(block("beta"));
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument());
    expect(screen.getByText("beta")).toBeInTheDocument();
    expect(screen.getByText("2 of 2 rules active")).toBeInTheDocument();
  });

  it("creates a rule via the form", async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText("No rules yet.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "New rule" }));
    fireEvent.change(screen.getByLabelText("Rule name"), { target: { value: "my redirect" } });
    fireEvent.change(screen.getByRole("textbox", { name: "URL filter" }), {
      target: { value: "||example.com" },
    });
    fireEvent.change(screen.getByLabelText("Redirect URL"), {
      target: { value: "https://b.test/" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create rule" }));

    await waitFor(async () => {
      const rules = await getRules();
      expect(rules).toHaveLength(1);
    });
    const rules = await getRules();
    expect(rules[0].name).toBe("my redirect");
    expect(rules[0].type).toBe("redirect");
    await waitFor(() => expect(screen.getByText("my redirect")).toBeInTheDocument());
  });

  it("shows a validation error when required fields are missing", async () => {
    render(<Dashboard />);
    fireEvent.click(await screen.findByRole("button", { name: "New rule" }));
    fireEvent.click(screen.getByRole("button", { name: "Create rule" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Name is required.");
    expect(await getRules()).toHaveLength(0);
  });

  it("deletes a rule", async () => {
    await addRule(block("doomed"));
    render(<Dashboard />);
    const del = await screen.findByRole("button", { name: "Delete doomed" });
    fireEvent.click(del);
    await waitFor(async () => expect(await getRules()).toHaveLength(0));
    await waitFor(() => expect(screen.queryByText("doomed")).not.toBeInTheDocument());
  });

  it("filters the list by search query", async () => {
    await addRule(redirect("keepme", "||keep.test"));
    await addRule(block("dropme"));
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText("keepme")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Search rules"), { target: { value: "keep" } });
    expect(screen.getByText("keepme")).toBeInTheDocument();
    expect(screen.queryByText("dropme")).not.toBeInTheDocument();
  });

  it("toggles a rule from the list", async () => {
    await addRule(block("toggle-me"));
    render(<Dashboard />);
    const toggle = await screen.findByRole("button", { name: "Toggle toggle-me" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggle);
    await waitFor(async () => {
      const rules = await getRules();
      expect(rules[0].enabled).toBe(false);
    });
  });

  it("groups rules under their group name", async () => {
    await addRule({ ...block("grouped"), groupId: "g1" });
    // Seed a matching group via the store so the name resolves.
    render(<Dashboard />);
    const input = await screen.findByLabelText("New group name");
    fireEvent.change(input, { target: { value: "My Group" } });
    fireEvent.click(screen.getByRole("button", { name: "Add group" }));
    await screen.findByLabelText("Delete group My Group");
    // Ungrouped section header should still be present for the seeded rule.
    expect(await screen.findByText("Ungrouped")).toBeInTheDocument();
  });

  it("edits an existing rule and disables the type select", async () => {
    await addRule(redirect("editable", "||edit.test"));
    render(<Dashboard />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit editable" }));
    const typeSelect = screen.getByLabelText("Rule type");
    expect(typeSelect).toBeDisabled();
    const name = screen.getByLabelText("Rule name");
    fireEvent.change(name, { target: { value: "renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(async () => {
      const rules = await getRules();
      expect(rules[0].name).toBe("renamed");
    });
  });

  it("scopes a toggle to its own row", async () => {
    await addRule(block("first"));
    await addRule(block("second"));
    render(<Dashboard />);
    const row = (await screen.findByText("second")).closest("li") as HTMLElement;
    const toggle = within(row).getByRole("button", { name: "Toggle second" });
    fireEvent.click(toggle);
    await waitFor(async () => {
      const rules = await getRules();
      const second = rules.find((r) => r.name === "second");
      expect(second?.enabled).toBe(false);
      expect(rules.find((r) => r.name === "first")?.enabled).toBe(true);
    });
  });
});
