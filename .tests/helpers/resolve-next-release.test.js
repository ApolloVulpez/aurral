import test from "node:test";
import assert from "node:assert/strict";

import { resolveNextRelease } from "../../lib/release-version.js";

test("resolveNextRelease publishes the exact requested stable version", () => {
  assert.deepEqual(
    resolveNextRelease({
      branch: "main",
      targetVersion: "2.0.0",
      allTags: ["v1.76.51", "v1.76.52-test.14"],
    }),
    {
      tag: "v2.0.0",
      version: "2.0.0",
      channel: "stable",
      isPrerelease: false,
      makeLatest: true,
      reusedExistingTag: false,
    },
  );
});

test("resolveNextRelease creates prereleases from the requested target", () => {
  assert.deepEqual(
    resolveNextRelease({
      branch: "dev",
      targetVersion: "2.1.0",
      allTags: ["v2.0.0", "v2.1.0-test.1"],
    }),
    {
      tag: "v2.1.0-dev.1",
      version: "2.1.0-dev.1",
      channel: "dev",
      isPrerelease: true,
      makeLatest: false,
      reusedExistingTag: false,
    },
  );
});

test("resolveNextRelease increments each prerelease channel independently", () => {
  assert.deepEqual(
    resolveNextRelease({
      branch: "test",
      targetVersion: "2.1.0",
      allTags: [
        "v2.0.0",
        "v2.1.0-dev.4",
        "v2.1.0-test.1",
        "v2.1.0-test.2",
      ],
    }),
    {
      tag: "v2.1.0-test.3",
      version: "2.1.0-test.3",
      channel: "test",
      isPrerelease: true,
      makeLatest: false,
      reusedExistingTag: false,
    },
  );
});

test("resolveNextRelease reuses the matching tag when a workflow is rerun", () => {
  assert.deepEqual(
    resolveNextRelease({
      branch: "main",
      targetVersion: "2.0.0",
      allTags: ["v1.76.51", "v2.0.0"],
      headTags: ["v1.76.52-dev.35", "v2.0.0"],
    }),
    {
      tag: "v2.0.0",
      version: "2.0.0",
      channel: "stable",
      isPrerelease: false,
      makeLatest: true,
      reusedExistingTag: true,
    },
  );
});

test("resolveNextRelease ignores unrelated legacy tags at the same commit", () => {
  assert.equal(
    resolveNextRelease({
      branch: "dev",
      targetVersion: "2.0.0",
      allTags: ["v1.76.51", "v1.76.52-dev.35"],
      headTags: ["v1.76.52-dev.35"],
    })?.tag,
    "v2.0.0-dev.1",
  );
});

test("resolveNextRelease rejects a stale or reused version", () => {
  assert.throws(
    () =>
      resolveNextRelease({
        branch: "main",
        targetVersion: "2.0.0",
        allTags: ["v2.0.0"],
      }),
    /must be newer than latest stable/,
  );

  assert.throws(
    () =>
      resolveNextRelease({
        branch: "test",
        targetVersion: "2.0.0",
        allTags: ["v2.0.0"],
      }),
    /must be newer than latest stable/,
  );
});

test("resolveNextRelease rejects malformed or prerelease targets", () => {
  for (const targetVersion of ["next", "2.0", "2.0.0-test.1"]) {
    assert.throws(
      () => resolveNextRelease({ branch: "main", targetVersion }),
      /must be a stable semantic version/,
    );
  }
});

test("resolveNextRelease ignores branches that are not release channels", () => {
  assert.equal(
    resolveNextRelease({ branch: "feat/example", targetVersion: "2.1.0" }),
    null,
  );
});
