"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const coverUrlService_1 = require("../src/app/services/coverUrlService");
(0, node_test_1.default)("upgrades soundcloud thumbnail variants to larger artwork urls", () => {
    strict_1.default.equal((0, coverUrlService_1.normalizeCoverUrl)("https://i1.sndcdn.com/artworks-abc123-large.jpg"), "https://i1.sndcdn.com/artworks-abc123-t500x500.jpg");
    strict_1.default.equal((0, coverUrlService_1.normalizeCoverUrl)("https://i1.sndcdn.com/artworks-abc123-small.jpg"), "https://i1.sndcdn.com/artworks-abc123-t500x500.jpg");
    strict_1.default.equal((0, coverUrlService_1.normalizeCoverUrl)("https://i1.sndcdn.com/artworks-abc123-crop.jpg"), "https://i1.sndcdn.com/artworks-abc123-t500x500.jpg");
});
(0, node_test_1.default)("prefers higher quality cover urls over low-res thumbnails", () => {
    const lowRes = "https://i1.sndcdn.com/artworks-abc123-small.jpg";
    const highRes = "https://i1.sndcdn.com/artworks-abc123-original.jpg";
    strict_1.default.equal((0, coverUrlService_1.normalizeCoverUrl)(lowRes), "https://i1.sndcdn.com/artworks-abc123-t500x500.jpg");
    strict_1.default.ok((0, coverUrlService_1.getCoverUrlQualityScore)(highRes) >= (0, coverUrlService_1.getCoverUrlQualityScore)(lowRes));
    strict_1.default.equal((0, coverUrlService_1.pickBestCoverUrl)(lowRes, highRes), highRes);
});
