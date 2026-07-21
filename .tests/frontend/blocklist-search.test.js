import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildBlocklistArtistSuggestions } from "../../frontend/src/utils/blocklistSearch.js";

test("blocklist suggestions include local artists when the catalog bucket is empty", () => {
  const suggestions = buildBlocklistArtistSuggestions({
    top: null,
    catalog: { artists: [] },
    library: {
      artists: [{ id: "radiohead", name: "Radiohead", type: "artist" }],
    },
  });

  assert.deepEqual(suggestions, [{ id: "radiohead", name: "Radiohead" }]);
});

test("blocklist suggestions combine and deduplicate unified artist results", () => {
  const suggestions = buildBlocklistArtistSuggestions(
    {
      top: { id: "radiohead", name: "Radiohead", type: "artist" },
      catalog: {
        artists: [
          { id: "radiohead", name: "Radiohead", type: "artist" },
          { id: "the-smile", name: "The Smile", type: "artist" },
        ],
      },
      library: {
        artists: [{ id: "atoms-for-peace", name: "Atoms for Peace", type: "artist" }],
      },
    },
    2,
  );

  assert.deepEqual(suggestions, [
    { id: "radiohead", name: "Radiohead" },
    { id: "the-smile", name: "The Smile" },
  ]);
});

test("Blocked Artists appears after Activity in the sidebar", async () => {
  const source = await readFile(
    new URL("../../frontend/src/components/Sidebar.jsx", import.meta.url),
    "utf8",
  );

  assert.ok(source.indexOf('label: "Activity"') < source.indexOf('label: "Blocked Artists"'));
});
