import assert from "node:assert/strict";
import test from "node:test";
import { convertSpotifyCsv } from "./spotifyCsvConverter.js";

test("converts Exportify CSV quoting and aliases into Aurral JSON", () => {
  const csv =
    '\uFEFFTrack Name,Artist Name(s),Album Name\r\n"Song, One","Artist ""A""",Album\nIncomplete,,Album';

  assert.deepEqual(convertSpotifyCsv(csv, "late-night_finds.csv"), {
    name: "late night finds",
    tracks: [{ artistName: 'Artist "A"', albumName: "Album", trackName: "Song, One" }],
  });
  assert.throws(
    () => convertSpotifyCsv("Album Name\nAlbum"),
    /track\/title column and an artist column/,
  );
});
