import assert from "node:assert/strict";
import test from "node:test";
import createCache from "../../backend/services/apiClients/simpleCache.js";
import createRateLimiter from "../../backend/services/apiClients/rateLimiter.js";
import axios from "../../lib/axiosFetch.js";

test("rate limiter spaces concurrent request starts", async () => {
  const limiter = createRateLimiter(30);
  const starts = [];
  await Promise.all(
    [1, 2, 3].map(() =>
      limiter.schedule(() => {
        starts.push(Date.now());
      }),
    ),
  );
  assert.ok(starts[1] - starts[0] >= 20);
  assert.ok(starts[2] - starts[1] >= 20);
});

test("TTL cache evicts its oldest entry at the size limit", () => {
  const cache = createCache(300, 2);
  cache.set("first", 1);
  cache.set("second", 2);
  cache.set("third", 3);
  assert.equal(cache.get("first"), undefined);
  assert.equal(cache.get("second"), 2);
  assert.equal(cache.get("third"), 3);
});

test("fetch transport failures expose axios-compatible request metadata", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };
  try {
    await assert.rejects(
      axios.get("http://lidarr.invalid/api/v1/status"),
      (error) =>
        error.request?.url === "http://lidarr.invalid/api/v1/status" &&
        error.request?.method === "GET",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
