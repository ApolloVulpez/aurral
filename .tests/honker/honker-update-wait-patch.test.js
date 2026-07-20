import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import {
  HONKER_UPDATE_WAIT_PATCH_MARKER,
  patchHonkerApiSource,
} from "../../backend/scripts/patchHonkerApi.js";

test("Honker update wait patch is installed", () => {
  const require = createRequire(import.meta.url);
  const apiPath = require.resolve("@russellthehippo/honker-node/api.js");
  const source = fs.readFileSync(apiPath, "utf8");
  assert.ok(source.includes(HONKER_UPDATE_WAIT_PATCH_MARKER));
});

test("Honker update wait patch is idempotent", () => {
  const source = `${HONKER_UPDATE_WAIT_PATCH_MARKER}\n`;
  assert.deepEqual(patchHonkerApiSource(source), {
    source,
    changed: false,
  });
});
