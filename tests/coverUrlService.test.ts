import test from "node:test";
import assert from "node:assert/strict";
import {
  getCoverUrlQualityScore,
  normalizeCoverUrl,
  pickBestCoverUrl,
} from "../src/app/services/coverUrlService";

test("upgrades soundcloud thumbnail variants to larger artwork urls", () => {
  assert.equal(
    normalizeCoverUrl("https://i1.sndcdn.com/artworks-abc123-large.jpg"),
    "https://i1.sndcdn.com/artworks-abc123-t500x500.jpg",
  );
  assert.equal(
    normalizeCoverUrl("https://i1.sndcdn.com/artworks-abc123-small.jpg"),
    "https://i1.sndcdn.com/artworks-abc123-t500x500.jpg",
  );
  assert.equal(
    normalizeCoverUrl("https://i1.sndcdn.com/artworks-abc123-crop.jpg"),
    "https://i1.sndcdn.com/artworks-abc123-t500x500.jpg",
  );
});

test("prefers higher quality cover urls over low-res thumbnails", () => {
  const lowRes = "https://i1.sndcdn.com/artworks-abc123-small.jpg";
  const highRes = "https://i1.sndcdn.com/artworks-abc123-original.jpg";

  assert.equal(
    normalizeCoverUrl(lowRes),
    "https://i1.sndcdn.com/artworks-abc123-t500x500.jpg",
  );
  assert.ok(getCoverUrlQualityScore(highRes) >= getCoverUrlQualityScore(lowRes));
  assert.equal(pickBestCoverUrl(lowRes, highRes), highRes);
});
