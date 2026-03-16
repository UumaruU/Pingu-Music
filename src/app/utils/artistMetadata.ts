import { Artist } from "../types";

function normalizeTagKey(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function mergeArtistTags(...tagLists: Array<string[] | undefined>) {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const tagList of tagLists) {
    for (const rawTag of tagList ?? []) {
      const tag = rawTag.trim();
      const normalizedTag = normalizeTagKey(tag);

      if (!normalizedTag || seen.has(normalizedTag)) {
        continue;
      }

      seen.add(normalizedTag);
      merged.push(tag);
    }
  }

  return merged;
}

export function mergeArtistMetadata(existingArtist: Artist | undefined, nextArtist: Artist): Artist {
  return {
    id: nextArtist.id || existingArtist?.id || "",
    name: nextArtist.name || existingArtist?.name || "",
    musicBrainzArtistId:
      nextArtist.musicBrainzArtistId || existingArtist?.musicBrainzArtistId || nextArtist.id,
    type: nextArtist.type ?? existingArtist?.type,
    country: nextArtist.country ?? existingArtist?.country,
    area: nextArtist.area ?? existingArtist?.area,
    beginArea: nextArtist.beginArea ?? existingArtist?.beginArea,
    disambiguation: nextArtist.disambiguation ?? existingArtist?.disambiguation,
    beginDate: nextArtist.beginDate ?? existingArtist?.beginDate,
    endDate: nextArtist.endDate ?? existingArtist?.endDate,
    tags: mergeArtistTags(nextArtist.tags, existingArtist?.tags),
    imageUrl: nextArtist.imageUrl ?? existingArtist?.imageUrl,
  };
}
