import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// Temporary compatibility patch for https://github.com/russellromney/honker/issues/67.
// Remove this script and the backend postinstall hook once a published Honker
// release contains equivalent abort-listener cleanup.

export const HONKER_ABORT_LISTENER_PATCH_MARKER =
  "const abortWait = abortPromise(signal);";

const ORIGINAL_ABORT_PROMISE = `function abortPromise(signal) {
  if (!signal) return new Promise(() => {});
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    signal.addEventListener('abort', resolve, { once: true });
  });
}`;

const PATCHED_ABORT_PROMISE = `function abortPromise(signal) {
  if (!signal) return { promise: new Promise(() => {}), cleanup() {} };
  if (signal.aborted) return { promise: Promise.resolve(), cleanup() {} };
  let onAbort = null;
  const promise = new Promise((resolve) => {
    onAbort = resolve;
    signal.addEventListener('abort', onAbort, { once: true });
  });
  return {
    promise,
    cleanup() {
      if (onAbort) signal.removeEventListener('abort', onAbort);
    },
  };
}`;

const ORIGINAL_WAIT_HELPER = `async function waitForUpdateOrTimeout(updateEvents, signal, timeoutMs) {
  if (aborted(signal)) return;
  const wait = updateEvents._subscribe();
  try {
    // Waiter promises reject on watcher death / close(); internal wait
    // loops treat that as an ordinary wake (they re-check their closed
    // flags and exit), so swallow it here.
    const settled = wait.promise.catch(() => undefined);
    if (timeoutMs == null) {
      await Promise.race([settled, abortPromise(signal)]);
      return;
    }
    const ms = Math.max(0, timeoutMs);
    await Promise.race([settled, delay(ms), abortPromise(signal)]);
  } finally {
    wait.cancel();
  }
}`;

const PATCHED_WAIT_HELPER = `async function waitForUpdateOrTimeout(updateEvents, signal, timeoutMs) {
  if (aborted(signal)) return;
  const wait = updateEvents._subscribe();
  ${HONKER_ABORT_LISTENER_PATCH_MARKER}
  try {
    // Waiter promises reject on watcher death / close(); internal wait
    // loops treat that as an ordinary wake (they re-check their closed
    // flags and exit), so swallow it here.
    const settled = wait.promise.catch(() => undefined);
    if (timeoutMs == null) {
      await Promise.race([settled, abortWait.promise]);
      return;
    }
    const ms = Math.max(0, timeoutMs);
    await Promise.race([settled, delay(ms), abortWait.promise]);
  } finally {
    abortWait.cleanup();
    wait.cancel();
  }
}`;

export function patchHonkerApiSource(source) {
  const input = String(source || "");
  if (
    input.includes(HONKER_ABORT_LISTENER_PATCH_MARKER) ||
    input.includes("signal.removeEventListener('abort'") ||
    input.includes('signal.removeEventListener("abort"')
  ) {
    return { source: input, changed: false };
  }
  if (!input.includes(ORIGINAL_ABORT_PROMISE) || !input.includes(ORIGINAL_WAIT_HELPER)) {
    throw new Error(
      "Unsupported @russellthehippo/honker-node api.js: abort-wait handling changed upstream",
    );
  }
  return {
    source: input
      .replace(ORIGINAL_ABORT_PROMISE, PATCHED_ABORT_PROMISE)
      .replace(ORIGINAL_WAIT_HELPER, PATCHED_WAIT_HELPER),
    changed: true,
  };
}

export function patchInstalledHonkerApi() {
  const require = createRequire(import.meta.url);
  const apiPath = require.resolve("@russellthehippo/honker-node/api.js");
  const current = fs.readFileSync(apiPath, "utf8");
  const patched = patchHonkerApiSource(current);
  if (patched.changed) {
    fs.writeFileSync(apiPath, patched.source);
  }
  return { apiPath, changed: patched.changed };
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const result = patchInstalledHonkerApi();
  console.log(
    result.changed
      ? "Patched Honker abort-listener cleanup"
      : "Honker abort-listener cleanup already present",
  );
}
