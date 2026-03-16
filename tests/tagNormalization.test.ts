import test from "node:test";
import assert from "node:assert/strict";
import { buildCanonicalTags, normalizeTag } from "../src/recommendation/tag-normalization/tagNormalization";

test("normalizes known tag aliases and ignores junk tags", () => {
  assert.deepEqual(normalizeTag("hip hop"), {
    slug: "hip-hop",
    displayName: "Hip-Hop",
    tagType: "genre",
  });
  assert.deepEqual(normalizeTag("alt hip hop"), {
    slug: "alternative-hip-hop",
    displayName: "Alternative Hip-Hop",
    tagType: "subgenre",
  });
  assert.equal(normalizeTag("favorites"), null);
});

test("builds canonical tags with merged evidence and stable ids", () => {
  const tags = buildCanonicalTags([
    {
      rawTag: "hip hop",
      evidence: {
        subjectType: "track",
        subjectCanonicalId: "track:a",
        source: "lastfm",
        sourceTrust: 0.75,
        extractionMethod: "unit-test",
        confidence: 0.7,
        weight: 1,
      },
    },
    {
      rawTag: "hiphop",
      evidence: {
        subjectType: "artist",
        subjectCanonicalId: "artist:a",
        source: "derived",
        sourceTrust: 0.65,
        extractionMethod: "unit-test",
        confidence: 0.5,
        weight: 0.8,
      },
    },
  ]);

  assert.deepEqual(Object.keys(tags), ["tag:hip-hop"]);
  assert.deepEqual(tags["tag:hip-hop"].aliases.sort(), ["hip hop", "hiphop"].sort());
  assert.equal(tags["tag:hip-hop"].sourceEvidence.length, 2);
});
