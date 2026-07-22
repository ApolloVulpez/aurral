import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { access, mkdir, writeFile } from "node:fs/promises";

import {
  setupIsolatedBackend,
  cleanupIsolatedState,
  createMockHttpServer,
  resetDatabase,
} from "../helpers/backendTestHarness.js";

const [
  isolatedState,
  { downloadTracker },
  { processYtdlpPipelinePayload },
  { processUsenetPipelinePayload },
  { dbOps },
  { db },
] = await setupIsolatedBackend(
  "download-review-routing",
  "backend/services/weeklyFlow/weeklyFlowDownloadTracker.js",
  "backend/services/ytdlpOrchestrator.js",
  "backend/services/usenetOrchestrator.js",
  "backend/db/helpers/index.js",
  "backend/config/db-sqlite.js",
);

test.beforeEach(() => {
  resetDatabase(db);
});

test.after(async () => {
  await cleanupIsolatedState(isolatedState);
});

async function writeOneSecondWav(filePath) {
  const sampleRate = 8000;
  const channels = 1;
  const bitsPerSample = 16;
  const dataSize = sampleRate * channels * (bitsPerSample / 8);
  const wav = Buffer.alloc(44 + dataSize);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  wav.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  wav.writeUInt16LE(bitsPerSample, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataSize, 40);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, wav);
}

function addDurationMismatchJob(playlistId) {
  const jobId = downloadTracker.addJob(
    {
      artistName: "Artist Name",
      trackName: "Correct Track",
      albumName: "Album Name",
      durationMs: 100000,
      trackNumber: 1,
    },
    playlistId,
  );
  downloadTracker.setDownloading(jobId);
  return jobId;
}

function failIfPipelineFallsThrough() {
  assert.fail("blocked download fell through to source retry");
}

async function assertReviewable(jobId, filePath, source) {
  const job = downloadTracker.getJob(jobId);
  assert.equal(job.status, "blocked");
  assert.equal(job.downloadSource, source);
  assert.equal(job.stagingPath, filePath);
  assert.match(job.error, /^blocked-duration-mismatch:/);
  await access(filePath);
}

test("yt-dlp sends plausible duration mismatches to review", async () => {
  const jobId = addDurationMismatchJob("ytdlp-review");
  const filePath = path.join(
    process.env.DOWNLOAD_FOLDER,
    ".ytdlp-staging",
    jobId,
    "Artist Name - Correct Track.wav",
  );
  await writeOneSecondWav(filePath);
  downloadTracker.updateDownloadMetadata(jobId, {
    downloadSource: "ytdlp",
    downloadClient: "ytdlp",
    releaseGuid: "video-1",
    remoteFilename: "Artist Name - Correct Track",
  });

  const result = await processYtdlpPipelinePayload(
    {
      phase: "finalize",
      source: "ytdlp",
      jobId,
      downloadedPath: filePath,
      destination: "ytdlp-review/Artist Name/Album Name",
      candidate: {
        raw: { id: "video-1", title: "Artist Name - Correct Track" },
      },
      candidateIndex: 0,
    },
    { failOrTryNextSource: failIfPipelineFallsThrough },
  );

  assert.equal(result, null);
  await assertReviewable(jobId, filePath, "ytdlp");
});

test("Usenet sends its best plausible duration mismatch to review", async () => {
  const server = await createMockHttpServer((req, res) => {
    req.resume();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: [] }));
  });

  try {
    const completedDir = path.join(process.env.DOWNLOAD_FOLDER, "usenet-complete");
    const filePath = path.join(
      completedDir,
      "Artist Name",
      "Album Name",
      "01 Correct Track.wav",
    );
    await writeOneSecondWav(filePath);
    dbOps.updateSettings({
      integrations: {
        nzbget: {
          enabled: true,
          url: server.url,
          completedPath: completedDir,
        },
      },
    });
    const jobId = addDurationMismatchJob("usenet-review");
    downloadTracker.updateDownloadMetadata(jobId, {
      downloadSource: "usenet",
      downloadClient: "nzbget",
      releaseGuid: "release-1",
      remoteFilename: "Artist Name - Album Name",
    });
    const candidate = {
      raw: {
        guid: "release-1",
        release: { guid: "release-1", title: "Artist Name - Album Name" },
      },
    };

    const result = await processUsenetPipelinePayload(
      {
        phase: "finalize",
        source: "usenet",
        jobId,
        nzbId: 1,
        destination: "usenet-review/Artist Name/Album Name",
        history: { FinalDir: completedDir },
        candidate,
        candidateIndex: 0,
      },
      { failOrTryNextSource: failIfPipelineFallsThrough },
    );

    assert.equal(result, null);
    await assertReviewable(jobId, filePath, "usenet");
  } finally {
    await server.close();
  }
});
