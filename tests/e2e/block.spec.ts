import { expect, test } from "@playwright/test";
import {
  type TestServer,
  clearRules,
  getServiceWorker,
  launchWithExtension,
  rule,
  seedRules,
  startTestServer,
} from "./helpers";

let server: TestServer;

test.beforeAll(async () => {
  server = await startTestServer();
});

test.afterAll(async () => {
  await server.close();
});

test("block rule cancels a matching request", async () => {
  const context = await launchWithExtension();
  try {
    const sw = await getServiceWorker(context);
    const base = `http://127.0.0.1:${server.port}`;
    await clearRules(sw);
    await seedRules(
      sw,
      [
        rule({
          name: "block the blocked endpoint",
          type: "block",
          condition: { urlFilter: `127.0.0.1:${server.port}/blocked` },
        }),
      ],
      1,
    );

    const page = await context.newPage();
    // Navigate to a normal page first so we can fetch from a real origin.
    await page.goto(`${base}/original`);
    const result = await page.evaluate(async (url) => {
      try {
        const r = await fetch(url);
        return `ok:${r.status}`;
      } catch {
        return "blocked";
      }
    }, `${base}/blocked`);
    expect(result).toBe("blocked");
  } finally {
    await context.close();
  }
});
