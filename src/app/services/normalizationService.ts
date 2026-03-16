// Frontend adapter: keeps legacy app import path while delegating pure logic to src/recommendation.

import { recommendationNormalizationService } from "../../recommendation/canonical-graph/normalization";

export const normalizationService = recommendationNormalizationService;
export const extractPrimaryArtistName = recommendationNormalizationService.extractPrimaryArtistName;
