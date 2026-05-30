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

test("replace rule rewrites a substring in the URL", async () => {
  const context = await launchWithExtension();
  try {
    const sw = await getServiceWorker(context);
    const base = `http://127.0.0.1:${server.port}`;
    await clearRules(sw);
    await seedRules(
      sw,
      [
        rule({
          name: "replace-from to replace-to",
          type: "replace",
          condition: { urlFilter: `127.0.0.1:${server.port}/replace-from` },
          from: "/replace-from",
          to: "/replace-to",
        }),
      ],
      1,
    );

    const page = await context.newPage();
    await page.goto(`${base}/replace-from`);
    // The request must be rewritten to /replace-to and serve its body.
    await expect(page.locator("body")).toContainText("REPLACE_TARGET");
    expect(page.url()).toContain("/replace-to");
  } finally {
    await context.close();
  }
});
