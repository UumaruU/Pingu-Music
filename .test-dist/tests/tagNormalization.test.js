"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const tagNormalization_1 = require("../src/recommendation/tag-normalization/tagNormalization");
(0, node_test_1.default)("normalizes known tag aliases and ignores junk tags", () => {
    strict_1.default.deepEqual((0, tagNormalization_1.normalizeTag)("hip hop"), {
        slug: "hip-hop",
        displayName: "Hip-Hop",
        tagType: "genre",
    });
    strict_1.default.deepEqual((0, tagNormalization_1.normalizeTag)("alt hip hop"), {
        slug: "alternative-hip-hop",
        displayName: "Alternative Hip-Hop",
        tagType: "subgenre",
    });
    strict_1.default.equal((0, tagNormalization_1.normalizeTag)("favorites"), null);
});
(0, node_test_1.default)("builds canonical tags with merged evidence and stable ids", () => {
    const tags = (0, tagNormalization_1.buildCanonicalTags)([
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
    strict_1.default.deepEqual(Object.keys(tags), ["tag:hip-hop"]);
    strict_1.default.deepEqual(tags["tag:hip-hop"].aliases.sort(), ["hip hop", "hiphop"].sort());
    strict_1.default.equal(tags["tag:hip-hop"].sourceEvidence.length, 2);
});
