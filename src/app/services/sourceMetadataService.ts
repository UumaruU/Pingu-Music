import { canonicalizationConfig } from "../config/canonicalizationConfig";
import { ProviderId, Track } from "../types";

export function getSourcePriority(providerId: ProviderId) {
  return canonicalizationConfig.sourcePriorityByProvider[providerId] ?? 0;
}

export function getSourceTrustScore(providerId: ProviderId) {
  return canonicalizationConfig.sourceTrustByProvider[providerId] ?? 0;
}

export function withSourceMetadata<T extends Track>(track: T): T {
  return {
    ...track,
    sourcePriority: track.sourcePriority ?? getSourcePriority(track.providerId),
    sourceTrustScore: track.sourceTrustScore ?? getSourceTrustScore(track.providerId),
  };
}
