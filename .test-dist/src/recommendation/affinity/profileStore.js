"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmptyProfiles = createEmptyProfiles;
exports.loadProfiles = loadProfiles;
exports.saveProfiles = saveProfiles;
exports.updateProfilesFromPlayback = updateProfilesFromPlayback;
exports.updateProfilesFromFavorite = updateProfilesFromFavorite;
exports.updateProfilesFromPlaylist = updateProfilesFromPlaylist;
exports.updateProfilesFromDislike = updateProfilesFromDislike;
const cacheKeys_1 = require("../caching/cacheKeys");
function emptyAffinityProfile() {
    return {
        updatedAt: new Date(0).toISOString(),
        trackAffinities: {},
        artistAffinities: {},
        tagAffinities: {},
        releaseAffinities: {},
        collaboratorAffinities: {},
        dislikedTrackIds: [],
    };
}
function emptyLongTermTasteProfile() {
    return {
        updatedAt: new Date(0).toISOString(),
        artistAffinities: {},
        tagAffinities: {},
        collaboratorAffinities: {},
        releaseAffinities: {},
        flavorAffinities: {},
        languageAffinities: {},
        eraAffinities: {},
    };
}
function emptySessionTasteProfile() {
    return {
        sessionId: "frontend-local",
        updatedAt: new Date(0).toISOString(),
        recentTrackIds: [],
        recentArtistIds: [],
        recentTagIds: [],
        recentRecommendationIds: [],
        recentSkippedTrackIds: [],
        recentFavoritedTrackIds: [],
        recentDislikedTrackIds: [],
        dominantMoodTagId: null,
        dominantGenreTagId: null,
        dominantFlavor: null,
        dominantDurationMs: null,
        channelPenalties: {
            sameArtist: 0,
            frequentCollaborators: 0,
            relatedArtists: 0,
            sharedTags: 0,
            releaseEraProximity: 0,
            sessionContinuation: 0,
            userAffinityRetrieval: 0,
        },
        replayCountByTrackId: {},
        replayCountByArtistId: {},
    };
}
function createEmptyProfiles() {
    return {
        longTerm: emptyLongTermTasteProfile(),
        session: emptySessionTasteProfile(),
        entity: emptyAffinityProfile(),
    };
}
function decayValue(entry, halfLifeMs, nowMs) {
    if (!entry) {
        return 0;
    }
    const updatedAt = Date.parse(entry.updatedAt);
    if (!Number.isFinite(updatedAt) || halfLifeMs <= 0) {
        return entry.value;
    }
    const elapsed = Math.max(0, nowMs - updatedAt);
    const decayFactor = Math.pow(0.5, elapsed / halfLifeMs);
    return entry.value * decayFactor;
}
function updateEntry(bag, key, delta, nowIso, halfLifeMs, nowMs) {
    const current = bag[key];
    const decayed = decayValue(current, halfLifeMs, nowMs);
    bag[key] = {
        value: decayed + delta,
        updatedAt: nowIso,
        eventCount: (current?.eventCount ?? 0) + 1,
    };
}
function collaboratorKey(leftId, rightId) {
    return leftId < rightId ? `${leftId}::${rightId}` : `${rightId}::${leftId}`;
}
function updateTrackDerivedAffinities(params) {
    const { track, profiles, deltaTrack, deltaArtist, deltaTag, deltaRelease, deltaCollaborator, config, occurredAt } = params;
    const nowMs = Date.parse(occurredAt);
    updateEntry(profiles.entity.trackAffinities, track.canonicalTrackId, deltaTrack, occurredAt, config.decay.longTermHalfLifeMs, nowMs);
    if (track.primaryCanonicalArtistId) {
        updateEntry(profiles.entity.artistAffinities, track.primaryCanonicalArtistId, deltaArtist, occurredAt, config.decay.longTermHalfLifeMs, nowMs);
        updateEntry(profiles.longTerm.artistAffinities, track.primaryCanonicalArtistId, deltaArtist, occurredAt, config.decay.longTermHalfLifeMs, nowMs);
    }
    track.tagIds.forEach((tagId) => {
        const weight = track.tagWeights[tagId] ?? 1;
        updateEntry(profiles.entity.tagAffinities, tagId, deltaTag * weight, occurredAt, config.decay.longTermHalfLifeMs, nowMs);
        updateEntry(profiles.longTerm.tagAffinities, tagId, deltaTag * weight, occurredAt, config.decay.longTermHalfLifeMs, nowMs);
    });
    if (track.canonicalReleaseId) {
        updateEntry(profiles.entity.releaseAffinities, track.canonicalReleaseId, deltaRelease, occurredAt, config.decay.longTermHalfLifeMs, nowMs);
        updateEntry(profiles.longTerm.releaseAffinities, track.canonicalReleaseId, deltaRelease, occurredAt, config.decay.longTermHalfLifeMs, nowMs);
    }
    const artistIds = track.canonicalArtistIds;
    for (let index = 0; index < artistIds.length; index += 1) {
        for (let innerIndex = index + 1; innerIndex < artistIds.length; innerIndex += 1) {
            updateEntry(profiles.entity.collaboratorAffinities, collaboratorKey(artistIds[index], artistIds[innerIndex]), deltaCollaborator, occurredAt, config.decay.longTermHalfLifeMs, nowMs);
            updateEntry(profiles.longTerm.collaboratorAffinities, collaboratorKey(artistIds[index], artistIds[innerIndex]), deltaCollaborator, occurredAt, config.decay.longTermHalfLifeMs, nowMs);
        }
    }
    const dominantFlavor = track.titleFlavor.find((flavor) => flavor !== "original") ?? track.titleFlavor[0];
    if (dominantFlavor) {
        updateEntry(profiles.longTerm.flavorAffinities, dominantFlavor, Math.max(deltaTag, deltaArtist * 0.25), occurredAt, config.decay.longTermHalfLifeMs, nowMs);
        profiles.session.dominantFlavor = dominantFlavor;
    }
    profiles.session.updatedAt = occurredAt;
    profiles.entity.updatedAt = occurredAt;
    profiles.longTerm.updatedAt = occurredAt;
}
function pushRecent(list, value, limit = 32) {
    return [value, ...list.filter((item) => item !== value)].slice(0, limit);
}
async function loadProfiles(cacheStore) {
    return (await cacheStore.getJson(cacheKeys_1.RECOMMENDATION_PROFILES_CACHE_KEY)) ?? createEmptyProfiles();
}
async function saveProfiles(cacheStore, profiles) {
    await cacheStore.setJson(cacheKeys_1.RECOMMENDATION_PROFILES_CACHE_KEY, profiles);
}
async function updateProfilesFromPlayback(params) {
    const profiles = await loadProfiles(params.cacheStore);
    const track = params.snapshot.tracksById[params.event.canonicalTrackId];
    if (!track) {
        return profiles;
    }
    const completionRatio = params.event.trackDurationMs > 0 ? params.event.listenedMs / params.event.trackDurationMs : 0;
    const occurredAt = params.event.occurredAt;
    profiles.session.sessionId = params.event.sessionId;
    profiles.session.recentTrackIds = pushRecent(profiles.session.recentTrackIds, track.canonicalTrackId);
    if (track.primaryCanonicalArtistId) {
        profiles.session.recentArtistIds = pushRecent(profiles.session.recentArtistIds, track.primaryCanonicalArtistId);
    }
    track.tagIds.forEach((tagId) => {
        profiles.session.recentTagIds = pushRecent(profiles.session.recentTagIds, tagId, 48);
    });
    profiles.session.dominantDurationMs = track.targetDurationMs ?? profiles.session.dominantDurationMs;
    if (completionRatio >= params.config.completionThresholds.veryStrongPositive) {
        updateTrackDerivedAffinities({
            track,
            profiles,
            deltaTrack: 4,
            deltaArtist: 3,
            deltaTag: 3,
            deltaRelease: 1,
            deltaCollaborator: 0.5,
            config: params.config,
            occurredAt,
        });
    }
    else if (completionRatio >= params.config.completionThresholds.strongPositive) {
        updateTrackDerivedAffinities({
            track,
            profiles,
            deltaTrack: 3,
            deltaArtist: 2,
            deltaTag: 2,
            deltaRelease: 1,
            deltaCollaborator: 0.5,
            config: params.config,
            occurredAt,
        });
    }
    else if (completionRatio < params.config.completionThresholds.strongNegative && params.event.wasSkipped) {
        updateTrackDerivedAffinities({
            track,
            profiles,
            deltaTrack: -4,
            deltaArtist: -2,
            deltaTag: -2,
            deltaRelease: -1,
            deltaCollaborator: -0.5,
            config: params.config,
            occurredAt,
        });
        profiles.session.recentSkippedTrackIds = pushRecent(profiles.session.recentSkippedTrackIds, track.canonicalTrackId);
        params.event.seedChannels.forEach((channel) => {
            profiles.session.channelPenalties[channel] = (profiles.session.channelPenalties[channel] ?? 0) + 1;
        });
    }
    else if (completionRatio < params.config.completionThresholds.negative && params.event.wasSkipped) {
        updateTrackDerivedAffinities({
            track,
            profiles,
            deltaTrack: -2,
            deltaArtist: -1,
            deltaTag: -1,
            deltaRelease: 0,
            deltaCollaborator: -0.25,
            config: params.config,
            occurredAt,
        });
        profiles.session.recentSkippedTrackIds = pushRecent(profiles.session.recentSkippedTrackIds, track.canonicalTrackId);
        params.event.seedChannels.forEach((channel) => {
            profiles.session.channelPenalties[channel] = (profiles.session.channelPenalties[channel] ?? 0) + 0.5;
        });
    }
    const replayCount = (profiles.session.replayCountByTrackId[track.canonicalTrackId] ?? 0) + 1;
    profiles.session.replayCountByTrackId[track.canonicalTrackId] = replayCount;
    if (track.primaryCanonicalArtistId) {
        const artistReplayCount = (profiles.session.replayCountByArtistId[track.primaryCanonicalArtistId] ?? 0) + 1;
        profiles.session.replayCountByArtistId[track.primaryCanonicalArtistId] = artistReplayCount;
    }
    if (replayCount > 1) {
        const replayDelta = 3 / (1 + Math.log1p(replayCount));
        updateTrackDerivedAffinities({
            track,
            profiles,
            deltaTrack: replayDelta,
            deltaArtist: 1 / (1 + Math.log1p(replayCount)),
            deltaTag: 1 / (1 + Math.log1p(replayCount)),
            deltaRelease: 0,
            deltaCollaborator: 0,
            config: params.config,
            occurredAt,
        });
    }
    await saveProfiles(params.cacheStore, profiles);
    return profiles;
}
async function updateProfilesFromFavorite(params) {
    const profiles = await loadProfiles(params.cacheStore);
    const track = params.snapshot.tracksById[params.event.canonicalTrackId];
    if (!track) {
        return profiles;
    }
    const direction = params.event.isFavorite ? 1 : -0.6;
    updateTrackDerivedAffinities({
        track,
        profiles,
        deltaTrack: 8 * direction,
        deltaArtist: 5 * direction,
        deltaTag: 4 * direction,
        deltaRelease: 2 * direction,
        deltaCollaborator: 1 * direction,
        config: params.config,
        occurredAt: params.event.occurredAt,
    });
    profiles.session.recentFavoritedTrackIds = pushRecent(profiles.session.recentFavoritedTrackIds, track.canonicalTrackId);
    await saveProfiles(params.cacheStore, profiles);
    return profiles;
}
async function updateProfilesFromPlaylist(params) {
    const profiles = await loadProfiles(params.cacheStore);
    const track = params.snapshot.tracksById[params.event.canonicalTrackId];
    if (!track) {
        return profiles;
    }
    const direction = params.event.isAdded ? 1 : -0.5;
    updateTrackDerivedAffinities({
        track,
        profiles,
        deltaTrack: 5 * direction,
        deltaArtist: 3 * direction,
        deltaTag: 3 * direction,
        deltaRelease: 1 * direction,
        deltaCollaborator: 0.25 * direction,
        config: params.config,
        occurredAt: params.event.occurredAt,
    });
    await saveProfiles(params.cacheStore, profiles);
    return profiles;
}
async function updateProfilesFromDislike(params) {
    const profiles = await loadProfiles(params.cacheStore);
    const track = params.snapshot.tracksById[params.event.canonicalTrackId];
    if (!track) {
        return profiles;
    }
    const direction = params.event.isDisliked ? -1 : 0.5;
    updateTrackDerivedAffinities({
        track,
        profiles,
        deltaTrack: 10 * direction,
        deltaArtist: 4 * direction,
        deltaTag: 4 * direction,
        deltaRelease: 2 * direction,
        deltaCollaborator: 0.5 * direction,
        config: params.config,
        occurredAt: params.event.occurredAt,
    });
    profiles.entity.dislikedTrackIds = params.event.isDisliked
        ? pushRecent(profiles.entity.dislikedTrackIds, track.canonicalTrackId, 128)
        : profiles.entity.dislikedTrackIds.filter((trackId) => trackId !== track.canonicalTrackId);
    profiles.session.recentDislikedTrackIds = params.event.isDisliked
        ? pushRecent(profiles.session.recentDislikedTrackIds, track.canonicalTrackId)
        : profiles.session.recentDislikedTrackIds.filter((trackId) => trackId !== track.canonicalTrackId);
    await saveProfiles(params.cacheStore, profiles);
    return profiles;
}
