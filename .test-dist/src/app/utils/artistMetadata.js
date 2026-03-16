"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeArtistTags = mergeArtistTags;
exports.mergeArtistMetadata = mergeArtistMetadata;
function normalizeTagKey(value) {
    return value
        .normalize("NFKC")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}
function mergeArtistTags(...tagLists) {
    const seen = new Set();
    const merged = [];
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
function mergeArtistMetadata(existingArtist, nextArtist) {
    return {
        id: nextArtist.id || existingArtist?.id || "",
        name: nextArtist.name || existingArtist?.name || "",
        musicBrainzArtistId: nextArtist.musicBrainzArtistId || existingArtist?.musicBrainzArtistId || nextArtist.id,
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
