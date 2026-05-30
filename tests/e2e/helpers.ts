import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type BrowserContext, type Worker, chromium } from "@playwright/test";

const dirname = fileURLToPath(new URL(".", import.meta.url));
export const DIST_PATH = resolve(dirname, "../../dist");

export interface TestServer {
  port: number;
  close: () => Promise<void>;
}

/**
 * Tiny deterministic HTTP server used as the interception target. Each endpoint
 * returns a fixed body/header so a test can assert exactly what the extension
 * did to the request/response.
 */
export async function startTestServer(): Promise<TestServer> {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";
    if (url === "/original") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ORIGINAL");
    } else if (url === "/target") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("REDIRECTED");
    } else if (url === "/echo-request-headers") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(req.headers));
    } else if (url === "/with-response-header") {
      res.writeHead(200, { "Content-Type": "text/plain", "X-Test-Response": "original" });
      res.end("OK");
    } else if (url === "/blocked") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("SHOULD_NOT_REACH");
    } else if (url === "/replace-from") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("WRONG_ENDPOINT");
    } else if (url === "/replace-to") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("REPLACE_TARGET");
    } else if (url === "/mock-me") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("REAL_BODY");
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("NOT_FOUND");
    }
  });

  await new Promise<void>((res) => server.listen(0, "127.0.0.1", res));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("server has no port");
  const { port } = addr;

  return {
    port,
    close: () => new Promise<void>((res, rej) => server.close((err) => (err ? rej(err) : res()))),
  };
}

/** Launch a persistent context with the built extension loaded (MV3 new-headless). */
export async function launchWithExtension(): Promise<BrowserContext> {
  return chromium.launchPersistentContext("", {
    headless: false,
    args: [
      "--headless=new",
      "--no-sandbox",
      `--disable-extensions-except=${DIST_PATH}`,
      `--load-extension=${DIST_PATH}`,
    ],
  });
}

/** Resolve the extension's MV3 service worker (it may register asynchronously). */
export async function getServiceWorker(context: BrowserContext): Promise<Worker> {
  const existing = context.serviceWorkers();
  if (existing.length > 0) return existing[0];
  return context.waitForEvent("serviceworker", { timeout: 15_000 });
}

/**
 * Seed rules into the extension's storage (which triggers the worker's
 * storage.onChanged → syncDynamicRules), then poll the live dNR set until the
 * expected number of dynamic rules has been applied.
 */
export async function seedRules(
  sw: Worker,
  rules: unknown[],
  expectedDnrCount: number,
): Promise<void> {
  const state = { rules, groups: [], nextDnrId: 1 };
  await sw.evaluate(async (s) => {
    await chrome.storage.local.set({ requestly_clone_state: s });
  }, state);
  await waitForDnrCount(sw, expectedDnrCount);
}

async function waitForDnrCount(sw: Worker, expected: number, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const count = await sw.evaluate(async () => {
      const r = await chrome.declarativeNetRequest.getDynamicRules();
      return r.length;
    });
    if (count >= expected) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`timeout waiting for ${expected} dynamic dNR rules`);
}

/** Reset stored + live dNR rules to empty between tests. */
export async function clearRules(sw: Worker): Promise<void> {
  await sw.evaluate(async () => {
    await chrome.storage.local.set({
      requestly_clone_state: { rules: [], groups: [], nextDnrId: 1 },
    });
  });
  await waitForDnrCount(sw, 0).catch(() => undefined);
}

/** Convenience: a complete enabled rule with timestamps filled in. */
export function rule(partial: Record<string, unknown>): Record<string, unknown> {
  return {
    id: partial.id ?? `e2e-${Math.round(performance.now())}-${Math.random()}`,
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  };
}
