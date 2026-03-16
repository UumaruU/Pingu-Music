"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCoverUrl = normalizeCoverUrl;
exports.isPlaceholderCoverUrl = isPlaceholderCoverUrl;
exports.getCoverUrlQualityScore = getCoverUrlQualityScore;
exports.pickBestCoverUrl = pickBestCoverUrl;
const LMUSIC_THUMBNAIL_SEGMENT = "/images/cover/75/";
const LMUSIC_FULLSIZE_SEGMENT = "/images/cover/";
const PLACEHOLDER_HINTS = ["placehold.co", "blank.jpg"];
const LOW_RES_HINT_PATTERN = /(?:\/(?:50|75|100|120|150|160|180|200)\b|thumb|thumbnail|avatar|-small\b|-tiny\b)/i;
const HIGH_RES_HINT_PATTERN = /(?:coverartarchive\.org|\/images\/cover\/(?!75\/)|-t500x500\b|-large\b|maxres|original|fullsize|full\b)/i;
function getCoverVariantRank(url) {
    const normalized = url.toLowerCase();
    if (normalized.includes("original")) {
        return 5;
    }
    if (normalized.includes("t500x500")) {
        return 4;
    }
    if (normalized.includes("crop")) {
        return 3;
    }
    if (normalized.includes("t300x300")) {
        return 2;
    }
    if (normalized.includes("large")) {
        return 1;
    }
    return 0;
}
function normalizeCoverUrl(url) {
    const trimmed = (url ?? "").trim();
    if (!trimmed) {
        return "";
    }
    if (trimmed.includes("lmusic.kz") && trimmed.includes(LMUSIC_THUMBNAIL_SEGMENT)) {
        return trimmed.replace(LMUSIC_THUMBNAIL_SEGMENT, LMUSIC_FULLSIZE_SEGMENT);
    }
    if (trimmed.includes("sndcdn.com") &&
        /-(?:mini|tiny|small|badge|t67x67|large|t300x300|crop)(\.[a-z0-9]+)(\?.*)?$/i.test(trimmed)) {
        return trimmed.replace(/-(?:mini|tiny|small|badge|t67x67|large|t300x300|crop)(\.[a-z0-9]+)(\?.*)?$/i, "-t500x500$1$2");
    }
    return trimmed;
}
function isPlaceholderCoverUrl(url) {
    const normalized = normalizeCoverUrl(url).toLowerCase();
    if (!normalized) {
        return true;
    }
    return PLACEHOLDER_HINTS.some((hint) => normalized.includes(hint));
}
function getCoverUrlQualityScore(url) {
    const normalized = normalizeCoverUrl(url);
    if (!normalized || isPlaceholderCoverUrl(normalized)) {
        return 0;
    }
    let score = 1;
    if (HIGH_RES_HINT_PATTERN.test(normalized)) {
        score += 3;
    }
    score += getCoverVariantRank(normalized) * 0.25;
    if (LOW_RES_HINT_PATTERN.test(normalized)) {
        score -= 2;
    }
    if (/\.(png|jpe?g|webp)(\?.*)?$/i.test(normalized)) {
        score += 0.4;
    }
    if (normalized.includes("?")) {
        score -= 0.1;
    }
    return Math.max(0, score);
}
function pickBestCoverUrl(...urls) {
    const candidates = urls
        .map((url, index) => ({
        url: normalizeCoverUrl(url),
        score: getCoverUrlQualityScore(url),
        index,
    }))
        .filter((candidate) => !!candidate.url);
    if (!candidates.length) {
        return "";
    }
    candidates.sort((left, right) => {
        if (left.score !== right.score) {
            return right.score - left.score;
        }
        const leftRank = getCoverVariantRank(left.url);
        const rightRank = getCoverVariantRank(right.url);
        if (leftRank !== rightRank) {
            return rightRank - leftRank;
        }
        if (left.url.length !== right.url.length) {
            return right.url.length - left.url.length;
        }
        return left.index - right.index;
    });
    return candidates[0]?.url ?? "";
}
