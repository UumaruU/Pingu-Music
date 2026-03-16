"use strict";
// Frontend adapter: keeps legacy app import path while delegating pure logic to src/recommendation.
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPrimaryArtistName = exports.normalizationService = void 0;
const normalization_1 = require("../../recommendation/canonical-graph/normalization");
exports.normalizationService = normalization_1.recommendationNormalizationService;
exports.extractPrimaryArtistName = normalization_1.recommendationNormalizationService.extractPrimaryArtistName;
