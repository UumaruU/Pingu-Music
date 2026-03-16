"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const artistMetadata_1 = require("../src/app/utils/artistMetadata");
(0, node_test_1.default)("merges artist tags from multiple sources without duplicates", () => {
    const merged = (0, artistMetadata_1.mergeArtistTags)(["hip hop", "rap", "Инди"], ["Rap", "Рок", "hip hop"]);
    strict_1.default.deepEqual(merged, ["hip hop", "rap", "Инди", "Рок"]);
});
(0, node_test_1.default)("preserves existing artist metadata while appending new external tags", () => {
    const merged = (0, artistMetadata_1.mergeArtistMetadata)({
        id: "artist-1",
        name: "Noize MC",
        musicBrainzArtistId: "artist-1",
        tags: ["alternative hip hop", "rap rock"],
        imageUrl: "https://example.com/current.jpg",
    }, {
        id: "artist-1",
        name: "Noize MC",
        musicBrainzArtistId: "artist-1",
        tags: ["Рэп и хип-хоп", "rap rock"],
    });
    strict_1.default.deepEqual(merged.tags, ["Рэп и хип-хоп", "rap rock", "alternative hip hop"]);
    strict_1.default.equal(merged.imageUrl, "https://example.com/current.jpg");
});
