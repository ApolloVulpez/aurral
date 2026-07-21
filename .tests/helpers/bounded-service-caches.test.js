import assert from "node:assert/strict";
import test from "node:test";
import { LidarrClient } from "../../backend/services/lidarrClient.js";
import { WeeklyFlowPlaylistSource } from "../../backend/services/weeklyFlow/weeklyFlowPlaylistSource.js";

test("Lidarr lifetime caches stay within fixed entry limits", () => {
  const client = new LidarrClient();
  for (let index = 0; index < 5500; index += 1) {
    client._setArtistByMbidCacheEntry(`artist-${index}`, { id: index });
  }
  for (let index = 0; index < 150; index += 1) {
    client._statusCache.set(`/history?page=${index}`, { data: [], at: Date.now() });
  }

  assert.ok(client._artistByMbidCache.size <= 5000);
  assert.ok(client._statusCache.size <= 100);
  assert.equal(client._artistByMbidCache.has("artist-0"), false);

  client._httpAgent.destroy();
  client._httpsAgent.destroy();
  client._httpsInsecureAgent.destroy();
});

test("Weekly Flow provider caches evict old unique keys", () => {
  const source = new WeeklyFlowPlaylistSource();
  for (let index = 0; index < 1100; index += 1) {
    source.artistTopTagsCache.set(`artist-${index}`, { value: [], expiresAt: Infinity });
    source.artistTopTracksCache.set(`tracks-${index}`, { trackList: [], expiresAt: Infinity });
    source.libraryOwnershipCache.set(`library-${index}`, { data: {}, expiresAt: Infinity });
  }
  for (let index = 0; index < 150; index += 1) {
    source.relatedArtistMatchCache.set(`seeds-${index}`, { value: new Map(), expiresAt: Infinity });
  }

  assert.ok(source.artistTopTagsCache.size <= 1000);
  assert.ok(source.artistTopTracksCache.size <= 1000);
  assert.ok(source.libraryOwnershipCache.size <= 1000);
  assert.ok(source.relatedArtistMatchCache.size <= 100);
  assert.equal(source.artistTopTagsCache.has("artist-0"), false);
});
