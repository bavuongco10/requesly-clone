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

test("mock rule returns a custom body via a data: URL", async () => {
  const context = await launchWithExtension();
  try {
    const sw = await getServiceWorker(context);
    const base = `http://127.0.0.1:${server.port}`;
    await clearRules(sw);
    await seedRules(
      sw,
      [
        rule({
          name: "mock the endpoint",
          type: "mock",
          condition: { urlFilter: `127.0.0.1:${server.port}/mock-me` },
          mock: { statusCode: 200, body: "MOCKED_BODY_123", contentType: "text/plain" },
        }),
      ],
      1,
    );

    const page = await context.newPage();
    await page.goto(`${base}/mock-me`);
    // The request is redirected to a data: URL carrying the mock body, NOT the
    // real server body ("REAL_BODY").
    expect(page.url().startsWith("data:")).toBe(true);
    await expect(page.locator("body")).toContainText("MOCKED_BODY_123");
  } finally {
    await context.close();
  }
});
