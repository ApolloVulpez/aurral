import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import {
  HONKER_ABORT_LISTENER_PATCH_MARKER,
  patchHonkerApiSource,
} from "../../backend/scripts/patchHonkerAbortListener.js";

test("Honker abort-listener patch is targeted and idempotent", () => {
  const require = createRequire(import.meta.url);
  const apiPath = require.resolve("@russellthehippo/honker-node/api.js");
  const installed = fs.readFileSync(apiPath, "utf8");
  const alreadyPatched = installed.includes(HONKER_ABORT_LISTENER_PATCH_MARKER);

  const first = patchHonkerApiSource(installed);
  assert.equal(first.changed, !alreadyPatched);
  assert.match(first.source, /removeEventListener\(['"]abort['"]/);

  const second = patchHonkerApiSource(first.source);
  assert.equal(second.changed, false);
  assert.equal(second.source, first.source);
});
