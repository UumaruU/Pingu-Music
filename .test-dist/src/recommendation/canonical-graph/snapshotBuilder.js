"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRecommendationCatalogSnapshot = buildRecommendationCatalogSnapshot;
const extractRelations_1 = require("../collaboration/extractRelations");
const tagNormalization_1 = require("../tag-normalization/tagNormalization");
const normalization_1 = require("./normalization");
const trackCanonicalization_1 = require("./trackCanonicalization");
function compareLexical(left, right) {
    return (left ?? "").localeCompare(right ?? "");
}
function createDeterministicHash(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0).toString(16);
}
function parseYear(date) {
    if (!date) {
        return null;
    }
    const match = date.match(/^(\d{4})/);
    return match ? Number(match[1]) : null;
}
function extractArtistNames(artistText) {
    return artistText
        .split(/\b(?:feat|ft|featuring|with|x|&|vs)\b|,|;/i)
        .map((part) => part.trim())
        .filter(Boolean);
}
function buildArtistLookup(sources) {
    const byId = new Map();
    const byMusicBrainzId = new Map();
    const byNormalizedName = new Map();
    sources.forEach((artist) => {
        byId.set(artist.id, artist);
        if (artist.musicBrainzArtistId) {
            byMusicBrainzId.set(artist.musicBrainzArtistId, artist);
        }
        byNormalizedName.set(normalization_1.recommendationNormalizationService.normalizeArtistCore(artist.name), artist);
    });
    return {
        byId,
        byMusicBrainzId,
        byNormalizedName,
    };
}
function buildReleaseLookup(releases) {
    const byId = new Map();
    const byMusicBrainzId = new Map();
    releases.forEach((release) => {
        byId.set(release.id, release);
        if (release.musicBrainzReleaseId) {
            byMusicBrainzId.set(release.musicBrainzReleaseId, release);
        }
    });
    return { byId, byMusicBrainzId };
}
function buildArtistId(rawArtistName, musicBrainzArtistId) {
    if (musicBrainzArtistId) {
        return `artist:${musicBrainzArtistId}`;
    }
    const normalized = normalization_1.recommendationNormalizationService.normalizeArtistCore(rawArtistName);
    return `artist:soft:${createDeterministicHash(normalized)}`;
}
function buildReleaseId(clusterTitle, musicBrainzReleaseId) {
    if (musicBrainzReleaseId) {
        return `release:${musicBrainzReleaseId}`;
    }
    const normalized = normalization_1.recommendationNormalizationService.normalizeTrackTitle(clusterTitle);
    return `release:soft:${createDeterministicHash(normalized)}`;
}
function buildSnapshotRevision(parts) {
    const payload = [
        parts.tracks
            .map((track) => `${track.id}:${track.metadataStatus ?? ""}:${track.musicBrainzRecordingId ?? ""}:${track.audioUrl ? "1" : "0"}`)
            .sort()
            .join("|"),
        parts.artists.map((artist) => `${artist.id}:${artist.name}:${(artist.tags ?? []).join(",")}`).sort().join("|"),
        parts.releases.map((release) => `${release.id}:${release.title}:${release.date ?? ""}`).sort().join("|"),
    ].join("::");
    return `snapshot:${createDeterministicHash(payload)}`;
}
function computeWeightedJaccard(left, right) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    let numerator = 0;
    let denominator = 0;
    keys.forEach((key) => {
        const leftWeight = left[key] ?? 0;
        const rightWeight = right[key] ?? 0;
        numerator += Math.min(leftWeight, rightWeight);
        denominator += Math.max(leftWeight, rightWeight);
    });
    return denominator > 0 ? numerator / denominator : 0;
}
function buildRelatedArtists(artistsById) {
    const relatedGraph = {};
    const artists = Object.values(artistsById);
    artists.forEach((artist) => {
        const neighbors = artists
            .filter((candidate) => candidate.canonicalArtistId !== artist.canonicalArtistId)
            .map((candidate) => ({
            candidate,
            similarity: computeWeightedJaccard(artist.tagWeights, candidate.tagWeights),
        }))
            .filter((entry) => entry.similarity >= 0.25)
            .sort((left, right) => {
            if (left.similarity !== right.similarity) {
                return right.similarity - left.similarity;
            }
            return left.candidate.canonicalArtistId.localeCompare(right.candidate.canonicalArtistId);
        })
            .slice(0, 12)
            .map(({ candidate, similarity }) => ({
            leftId: artist.canonicalArtistId,
            rightId: candidate.canonicalArtistId,
            weight: similarity,
            source: "derived",
            confidence: Math.min(1, similarity + 0.1),
            reason: "shared-tag-similarity",
        }));
        relatedGraph[artist.canonicalArtistId] = neighbors;
        artist.relatedArtistIds = neighbors.map((neighbor) => neighbor.rightId);
    });
    return relatedGraph;
}
function buildRecommendationCatalogSnapshot(input) {
    const snapshotRevision = buildSnapshotRevision(input);
    const canonicalizationResult = trackCanonicalization_1.recommendationTrackCanonicalizationService.buildCanonicalizationResult({
        searchSetId: snapshotRevision,
        tracks: input.tracks,
        canonicalizationRevision: 1,
        config: input.config.canonicalization,
        includeDebugInfo: true,
    });
    const trackById = new Map(input.tracks.map((track) => [track.id, track]));
    const artistLookup = buildArtistLookup(input.artists);
    const releaseLookup = buildReleaseLookup(input.releases);
    const rawTagInputs = [];
    const artistsById = {};
    const releasesById = {};
    const tracksById = {};
    const artistToTracks = {};
    const releaseToTracks = {};
    const artistToReleases = {};
    const trackToArtists = {};
    const playableVariantsByCanonicalTrackId = {};
    canonicalizationResult.canonicalTracks.forEach((cluster) => {
        const sourceVariants = cluster.variantTrackIds
            .map((trackId) => trackById.get(trackId))
            .filter((track) => !!track);
        const artistNames = dedupeArtistNames(sourceVariants.flatMap((track) => extractArtistNames(track.artist)));
        const primaryArtistName = artistNames[0] ?? cluster.artist;
        const primarySourceArtist = (cluster.musicBrainzArtistId ? artistLookup.byMusicBrainzId.get(cluster.musicBrainzArtistId) : undefined) ??
            artistLookup.byNormalizedName.get(normalization_1.recommendationNormalizationService.normalizeArtistCore(primaryArtistName));
        const canonicalArtistIds = artistNames.map((artistName, index) => {
            const sourceArtist = (index === 0 ? primarySourceArtist : undefined) ??
                artistLookup.byNormalizedName.get(normalization_1.recommendationNormalizationService.normalizeArtistCore(artistName));
            const canonicalArtistId = buildArtistId(artistName, sourceArtist?.musicBrainzArtistId ?? null);
            if (!artistsById[canonicalArtistId]) {
                artistsById[canonicalArtistId] = {
                    canonicalArtistId,
                    musicBrainzArtistId: sourceArtist?.musicBrainzArtistId ?? null,
                    name: sourceArtist?.name ?? artistName,
                    normalizedName: normalization_1.recommendationNormalizationService.normalizeArtistCore(sourceArtist?.name ?? artistName),
                    aliases: sourceArtist?.name && sourceArtist.name !== artistName ? [artistName] : [],
                    country: sourceArtist?.country ?? null,
                    type: sourceArtist?.type ?? null,
                    tagIds: [],
                    tagWeights: {},
                    relatedArtistIds: [],
                    frequentCollaboratorIds: [],
                    releaseIds: [],
                    trackIds: [],
                    sourceEvidence: [],
                    quality: {
                        confidence: sourceArtist?.musicBrainzArtistId ? 0.9 : 0.6,
                        trustScore: sourceArtist?.musicBrainzArtistId ? 0.9 : 0.55,
                        metadataCompleteness: sourceArtist?.tags?.length ? 0.7 : 0.35,
                    },
                    debugInfo: {
                        inferredFromArtistText: sourceArtist ? false : true,
                        relationHint: (0, extractRelations_1.inferRelationTypeFromArtistText)(cluster.artist),
                    },
                };
            }
            artistsById[canonicalArtistId].trackIds = dedupeAndSort([
                ...artistsById[canonicalArtistId].trackIds,
                cluster.canonicalId,
            ]);
            (sourceArtist?.tags ?? []).forEach((tag) => {
                rawTagInputs.push({
                    rawTag: tag,
                    evidence: {
                        subjectType: "artist",
                        subjectCanonicalId: canonicalArtistId,
                        source: sourceArtist?.musicBrainzArtistId ? "musicbrainz" : "derived",
                        sourceTrust: sourceArtist?.musicBrainzArtistId ? 0.75 : 0.45,
                        extractionMethod: "artist-source-tags",
                        confidence: 0.7,
                        weight: 1,
                    },
                });
            });
            return canonicalArtistId;
        });
        const canonicalReleaseId = cluster.musicBrainzReleaseId || cluster.album
            ? buildReleaseId(cluster.musicBrainzReleaseId ?? cluster.album ?? cluster.canonicalId, cluster.musicBrainzReleaseId)
            : null;
        const sourceRelease = (cluster.musicBrainzReleaseId ? releaseLookup.byMusicBrainzId.get(cluster.musicBrainzReleaseId) : undefined) ??
            (cluster.album
                ? input.releases.find((release) => normalization_1.recommendationNormalizationService.normalizeTrackTitle(release.title) ===
                    normalization_1.recommendationNormalizationService.normalizeTrackTitle(cluster.album ?? ""))
                : undefined);
        if (canonicalReleaseId) {
            if (!releasesById[canonicalReleaseId]) {
                releasesById[canonicalReleaseId] = {
                    canonicalReleaseId,
                    musicBrainzReleaseId: sourceRelease?.musicBrainzReleaseId ?? cluster.musicBrainzReleaseId ?? null,
                    musicBrainzReleaseGroupId: sourceRelease?.musicBrainzReleaseGroupId ?? cluster.musicBrainzReleaseGroupId ?? null,
                    title: sourceRelease?.title ?? cluster.album ?? cluster.title,
                    canonicalArtistIds: [],
                    releaseType: sourceRelease?.kind ?? "other",
                    year: parseYear(sourceRelease?.date ?? sourceVariants[0]?.releaseDate),
                    labelIds: [],
                    coverUrl: sourceRelease?.coverUrl ?? cluster.coverUrl ?? null,
                    trackIds: [],
                    tagIds: [],
                    sourceEvidence: [],
                    quality: {
                        confidence: sourceRelease?.musicBrainzReleaseId ? 0.85 : 0.55,
                        trustScore: sourceRelease?.musicBrainzReleaseId ? 0.9 : 0.5,
                        metadataCompleteness: sourceRelease?.date ? 0.65 : 0.35,
                    },
                };
            }
            releasesById[canonicalReleaseId].trackIds = dedupeAndSort([
                ...releasesById[canonicalReleaseId].trackIds,
                cluster.canonicalId,
            ]);
            releasesById[canonicalReleaseId].canonicalArtistIds = dedupeAndSort([
                ...releasesById[canonicalReleaseId].canonicalArtistIds,
                ...canonicalArtistIds,
            ]);
            canonicalArtistIds.forEach((artistId) => {
                artistsById[artistId].releaseIds = dedupeAndSort([
                    ...artistsById[artistId].releaseIds,
                    canonicalReleaseId,
                ]);
            });
        }
        const trackTagWeights = {};
        cluster.titleFlavor.forEach((flavor) => {
            rawTagInputs.push({
                rawTag: flavor,
                evidence: {
                    subjectType: "track",
                    subjectCanonicalId: cluster.canonicalId,
                    source: "derived",
                    sourceTrust: 0.65,
                    extractionMethod: "title-flavor",
                    confidence: 0.8,
                    weight: flavor === "original" ? 0.2 : 1,
                },
            });
        });
        const popularityPrior = sourceVariants.reduce((best, variant) => {
            const providerPrior = input.providerMetadata[variant.providerId]?.popularityPrior ?? 0;
            return Math.max(best, providerPrior);
        }, 0);
        const playableVariantIds = cluster.variantTrackIds.filter((trackId) => {
            const variant = trackById.get(trackId);
            return !!variant?.audioUrl;
        });
        tracksById[cluster.canonicalId] = {
            canonicalTrackId: cluster.canonicalId,
            musicBrainzRecordingId: cluster.musicBrainzRecordingId ?? null,
            acoustId: cluster.acoustId ?? null,
            title: cluster.title,
            normalizedTitleCore: cluster.normalizedTitleCore ?? normalization_1.recommendationNormalizationService.normalizeTrackTitleCore(cluster.title),
            titleFlavor: cluster.titleFlavor,
            canonicalArtistIds,
            primaryCanonicalArtistId: canonicalArtistIds[0] ?? null,
            featuringCanonicalArtistIds: canonicalArtistIds.slice(1),
            canonicalReleaseId,
            year: parseYear(sourceVariants[0]?.releaseDate),
            labelIds: [],
            language: null,
            explicit: cluster.explicit ?? null,
            targetDurationMs: (cluster.targetDuration ?? 0) * 1000,
            tagIds: [],
            tagWeights: trackTagWeights,
            preferredVariantId: cluster.preferredVariantId ?? null,
            playableVariantIds,
            sourceEvidence: sourceVariants.map((variant) => ({
                canonicalTrackId: cluster.canonicalId,
                provider: variant.providerId,
                rawTrackId: variant.id,
                rawTitle: variant.title,
                rawArtist: variant.artist,
                playable: !!variant.audioUrl,
                duration: variant.duration,
                confidence: variant.musicBrainzRecordingId ? 0.95 : variant.acoustId ? 0.9 : 0.6,
            })),
            quality: {
                clusterConfidence: cluster.quality?.clusterConfidence ?? 0.55,
                trustScore: cluster.quality?.sourceTrustScore ?? 0.5,
                metadataCompleteness: cluster.album || cluster.musicBrainzRecordingId ? 0.8 : 0.45,
                popularityPrior,
            },
            debugInfo: {
                clusterDebugInfo: cluster.debugInfo,
                sourceVariantIds: cluster.variantTrackIds,
            },
        };
        trackToArtists[cluster.canonicalId] = canonicalArtistIds;
        playableVariantsByCanonicalTrackId[cluster.canonicalId] = playableVariantIds.sort(compareLexical);
        canonicalArtistIds.forEach((artistId) => {
            artistToTracks[artistId] = dedupeAndSort([...(artistToTracks[artistId] ?? []), cluster.canonicalId]);
            if (canonicalReleaseId) {
                artistToReleases[artistId] = dedupeAndSort([...(artistToReleases[artistId] ?? []), canonicalReleaseId]);
            }
        });
        if (canonicalReleaseId) {
            releaseToTracks[canonicalReleaseId] = dedupeAndSort([
                ...(releaseToTracks[canonicalReleaseId] ?? []),
                cluster.canonicalId,
            ]);
        }
    });
    const tagsById = (0, tagNormalization_1.buildCanonicalTags)(rawTagInputs);
    Object.values(tagsById).forEach((tag) => {
        tag.sourceEvidence.forEach((evidence) => {
            if (evidence.subjectType === "track" && tracksById[evidence.subjectCanonicalId]) {
                tracksById[evidence.subjectCanonicalId].tagIds = dedupeAndSort([
                    ...tracksById[evidence.subjectCanonicalId].tagIds,
                    tag.canonicalTagId,
                ]);
                tracksById[evidence.subjectCanonicalId].tagWeights[tag.canonicalTagId] = Math.max(tracksById[evidence.subjectCanonicalId].tagWeights[tag.canonicalTagId] ?? 0, evidence.weight);
            }
            if (evidence.subjectType === "artist" && artistsById[evidence.subjectCanonicalId]) {
                artistsById[evidence.subjectCanonicalId].tagIds = dedupeAndSort([
                    ...artistsById[evidence.subjectCanonicalId].tagIds,
                    tag.canonicalTagId,
                ]);
                artistsById[evidence.subjectCanonicalId].tagWeights[tag.canonicalTagId] = Math.max(artistsById[evidence.subjectCanonicalId].tagWeights[tag.canonicalTagId] ?? 0, evidence.weight);
            }
        });
    });
    Object.values(releasesById).forEach((release) => {
        release.tagIds = dedupeAndSort(release.canonicalArtistIds.flatMap((artistId) => artistsById[artistId]?.tagIds ?? []));
    });
    const relatedArtists = buildRelatedArtists(artistsById);
    const collaborationEvidence = (0, extractRelations_1.extractArtistRelations)({
        artistsById,
        tracksById,
    });
    const artistRelations = (0, extractRelations_1.buildArtistRelationGraph)(collaborationEvidence);
    Object.values(artistsById).forEach((artist) => {
        artist.frequentCollaboratorIds = (artistRelations[artist.canonicalArtistId] ?? [])
            .filter((edge) => edge.weight >= 0.4)
            .map((edge) => edge.rightId);
    });
    const tagToTracks = {};
    const tagToArtists = {};
    Object.values(tracksById).forEach((track) => {
        track.tagIds.forEach((tagId) => {
            tagToTracks[tagId] = dedupeAndSort([...(tagToTracks[tagId] ?? []), track.canonicalTrackId]);
        });
    });
    Object.values(artistsById).forEach((artist) => {
        artist.tagIds.forEach((tagId) => {
            tagToArtists[tagId] = dedupeAndSort([...(tagToArtists[tagId] ?? []), artist.canonicalArtistId]);
        });
    });
    const releaseAdjacency = {};
    Object.values(releasesById).forEach((release) => {
        const neighbors = Object.values(releasesById)
            .filter((candidate) => candidate.canonicalReleaseId !== release.canonicalReleaseId)
            .filter((candidate) => candidate.canonicalArtistIds.some((artistId) => release.canonicalArtistIds.includes(artistId)) ||
            (release.year !== null &&
                candidate.year !== null &&
                release.year !== undefined &&
                candidate.year !== undefined &&
                Math.abs((release.year ?? 0) - (candidate.year ?? 0)) <= 2))
            .map((candidate) => candidate.canonicalReleaseId)
            .sort(compareLexical);
        releaseAdjacency[release.canonicalReleaseId] = neighbors;
    });
    return {
        snapshotRevision,
        generatedAt: new Date().toISOString(),
        canonicalizationVersion: canonicalizationResult.canonicalizationVersion,
        canonicalizationRevision: canonicalizationResult.canonicalizationRevision,
        tracksById,
        artistsById,
        releasesById,
        tagsById,
        canonicalIdByVariantTrackId: canonicalizationResult.canonicalIdByVariantTrackId,
        artistToTracks,
        releaseToTracks,
        trackToArtists,
        artistToReleases,
        artistRelations,
        relatedArtists,
        tagToTracks,
        tagToArtists,
        releaseAdjacency,
        playableVariantsByCanonicalTrackId,
    };
}
function dedupeAndSort(values) {
    return [...new Set(values.filter(Boolean))].sort(compareLexical);
}
function dedupeArtistNames(values) {
    return dedupeAndSort(values.map((value) => value.trim()));
}
