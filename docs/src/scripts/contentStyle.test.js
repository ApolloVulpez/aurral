import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

test("docs use keyboard-safe ASCII characters", () => {
  const files = [
    ...sourceFiles(`${sourceRoot}/content/docs`),
    ...sourceFiles(`${sourceRoot}/components`),
    fileURLToPath(new URL("../../astro.config.mjs", import.meta.url)),
  ];
  const invalid = files.flatMap((file) => {
    const source = readFileSync(file, "utf8");
    const match = source.match(/[^\x09\x0a\x0d\x20-\x7e]/);
    return match ? [`${file}:${source.slice(0, match.index).split("\n").length}`] : [];
  });

  assert.deepEqual(invalid, []);
});
