import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

export const HONKER_UPDATE_WAIT_PATCH_MARKER =
  "const pendingHonkerUpdateWaits = new WeakMap();";

const ORIGINAL_WAIT_HELPER = `async function waitForUpdateOrTimeout(updateEvents, signal, timeoutMs) {
  if (aborted(signal)) return;
  if (timeoutMs == null) {
    await Promise.race([
      updateEvents.next().catch(() => undefined),
      abortPromise(signal),
    ]);
    return;
  }
  const ms = Math.max(0, timeoutMs);
  await Promise.race([
    updateEvents.next().catch(() => undefined),
    delay(ms),
    abortPromise(signal),
  ]);
}`;

const PATCHED_WAIT_HELPER = `${HONKER_UPDATE_WAIT_PATCH_MARKER}

function waitForNextHonkerUpdate(updateEvents) {
  let pending = pendingHonkerUpdateWaits.get(updateEvents);
  if (pending) return pending;

  pending = Promise.resolve()
    .then(() => updateEvents.next())
    .catch(() => undefined);
  pendingHonkerUpdateWaits.set(updateEvents, pending);
  pending.finally(() => {
    if (pendingHonkerUpdateWaits.get(updateEvents) === pending) {
      pendingHonkerUpdateWaits.delete(updateEvents);
    }
  });
  return pending;
}

async function waitForUpdateOrTimeout(updateEvents, signal, timeoutMs) {
  if (aborted(signal)) return;

  let onAbort = null;
  const abortWait = signal
    ? new Promise((resolve) => {
        onAbort = resolve;
        signal.addEventListener('abort', onAbort, { once: true });
      })
    : new Promise(() => {});
  const waits = [waitForNextHonkerUpdate(updateEvents), abortWait];
  if (timeoutMs != null) {
    waits.push(delay(Math.max(0, timeoutMs)));
  }

  try {
    await Promise.race(waits);
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
}`;

export function patchHonkerApiSource(source) {
  const input = String(source || "");
  if (input.includes(HONKER_UPDATE_WAIT_PATCH_MARKER)) {
    return { source: input, changed: false };
  }
  if (!input.includes(ORIGINAL_WAIT_HELPER)) {
    throw new Error(
      "Unsupported @russellthehippo/honker-node api.js: update-wait helper changed upstream",
    );
  }
  return {
    source: input.replace(ORIGINAL_WAIT_HELPER, PATCHED_WAIT_HELPER),
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
      ? "Patched Honker update wait handling"
      : "Honker update wait handling already patched",
  );
}
