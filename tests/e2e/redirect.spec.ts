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

test("redirect rule sends URL A to URL B", async () => {
  const context = await launchWithExtension();
  try {
    const sw = await getServiceWorker(context);
    const base = `http://127.0.0.1:${server.port}`;
    await clearRules(sw);
    await seedRules(
      sw,
      [
        rule({
          name: "redirect original to target",
          type: "redirect",
          condition: { urlFilter: `127.0.0.1:${server.port}/original` },
          redirect: { url: `${base}/target` },
        }),
      ],
      1,
    );

    const page = await context.newPage();
    await page.goto(`${base}/original`);
    // The body served must be the redirect TARGET, not the original.
    await expect(page.locator("body")).toContainText("REDIRECTED");
    expect(page.url()).toContain("/target");
  } finally {
    await context.close();
  }
});
