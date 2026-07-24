import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("image proxy cache size and clear operations are asynchronous", async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "aurral-image-cache-"));
  const previousDataDir = process.env.AURRAL_DATA_DIR;
  process.env.AURRAL_DATA_DIR = dataDir;
  try {
    const { clearImageProxyCache, getImageProxyCacheSizeBytes } = await import(
      `../backend/services/imageProxyService.js?cache-test=${Date.now()}`
    );
    const cacheDir = path.join(dataDir, "image-proxy");
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(path.join(cacheDir, "sample.webp"), "abc");

    assert.equal(await getImageProxyCacheSizeBytes(), 3);
    await clearImageProxyCache();
    assert.deepEqual(await fs.readdir(cacheDir), []);
  } finally {
    if (previousDataDir === undefined) delete process.env.AURRAL_DATA_DIR;
    else process.env.AURRAL_DATA_DIR = previousDataDir;
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("image proxy caches one card-sized webp instead of full-resolution sources", async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "aurral-image-card-"));
  const previousDataDir = process.env.AURRAL_DATA_DIR;
  const originalFetch = global.fetch;
  process.env.AURRAL_DATA_DIR = dataDir;
  try {
    const sharp = (await import("sharp")).default;
    const { warmImageProxy } = await import(
      `../backend/services/imageProxyService.js?card-test=${Date.now()}`
    );
    const source = await sharp({
      create: {
        width: 2000,
        height: 1600,
        channels: 3,
        background: { r: 40, g: 80, b: 120 },
      },
    })
      .png()
      .toBuffer();

    global.fetch = async () =>
      new Response(source, { headers: { "content-type": "image/png" } });

    const cached = await warmImageProxy("https://images.example/large-card.png");
    assert.equal(cached.meta.contentType, "image/webp");
    assert.ok(cached.meta.size <= 150 * 1024);

    const meta = await sharp(cached.imagePath).metadata();
    assert.equal(meta.format, "webp");
    assert.ok(Math.max(meta.width, meta.height) <= 512);
  } finally {
    global.fetch = originalFetch;
    if (previousDataDir === undefined) delete process.env.AURRAL_DATA_DIR;
    else process.env.AURRAL_DATA_DIR = previousDataDir;
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});
