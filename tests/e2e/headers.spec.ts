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

test("modifyHeaders adds a request header the server can see", async () => {
  const context = await launchWithExtension();
  try {
    const sw = await getServiceWorker(context);
    const base = `http://127.0.0.1:${server.port}`;
    await clearRules(sw);
    await seedRules(
      sw,
      [
        rule({
          name: "add request header",
          type: "modifyHeaders",
          condition: { urlFilter: `127.0.0.1:${server.port}/echo-request-headers` },
          requestHeaders: [{ header: "X-Test-Request", operation: "set", value: "injected" }],
        }),
      ],
      1,
    );

    const page = await context.newPage();
    await page.goto(`${base}/original`);
    const headers = await page.evaluate(async (url) => {
      const r = await fetch(url);
      return (await r.json()) as Record<string, string>;
    }, `${base}/echo-request-headers`);
    expect(headers["x-test-request"]).toBe("injected");
  } finally {
    await context.close();
  }
});

test("modifyHeaders sets a response header the client receives", async () => {
  const context = await launchWithExtension();
  try {
    const sw = await getServiceWorker(context);
    const base = `http://127.0.0.1:${server.port}`;
    await clearRules(sw);
    await seedRules(
      sw,
      [
        rule({
          name: "set response header",
          type: "modifyHeaders",
          condition: { urlFilter: `127.0.0.1:${server.port}/with-response-header` },
          responseHeaders: [{ header: "X-Test-Response", operation: "set", value: "modified" }],
        }),
      ],
      1,
    );

    const page = await context.newPage();
    await page.goto(`${base}/original`);
    const value = await page.evaluate(async (url) => {
      const r = await fetch(url);
      return r.headers.get("X-Test-Response");
    }, `${base}/with-response-header`);
    expect(value).toBe("modified");
  } finally {
    await context.close();
  }
});
