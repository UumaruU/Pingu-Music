import { cacheService } from "./cacheService";
import { normalizeCoverUrl, pickBestCoverUrl } from "./coverUrlService";
import { tauriBridge } from "./tauriBridge";

const PLACEHOLDER_COVER_URL = "https://placehold.co/300x300?text=Pingu+Music";

function requiresArtworkRevalidation(url: string | undefined) {
  const normalizedUrl = (url ?? "").trim().toLowerCase();

  if (!normalizedUrl) {
    return false;
  }

  return (
    normalizedUrl.includes("coverartarchive.org") ||
    normalizedUrl.includes(".archive.org") ||
    normalizedUrl.includes("ca.archive.org")
  );
}

export const coverArtService = {
  async resolveCoverUrl(releaseId: string | undefined, sourceCoverUrl: string) {
    if (!releaseId) {
      return normalizeCoverUrl(sourceCoverUrl) || PLACEHOLDER_COVER_URL;
    }

    const cachedUrl = await cacheService.get<string>("artwork", releaseId);
    const normalizedCachedUrl = normalizeCoverUrl(cachedUrl);

    if (normalizedCachedUrl && !requiresArtworkRevalidation(normalizedCachedUrl)) {
      return normalizedCachedUrl;
    }

    try {
      if (tauriBridge.isTauriRuntime()) {
        const resolvedUrl = await tauriBridge.resolveCoverArtUrl(releaseId);

        if (resolvedUrl) {
          const normalizedResolvedUrl = normalizeCoverUrl(resolvedUrl);
          await cacheService.set("artwork", releaseId, normalizedResolvedUrl);
          return normalizedResolvedUrl;
        }
      }
    } catch {
      // Fall through to source cover.
    }

    const fallback = pickBestCoverUrl(normalizedCachedUrl, sourceCoverUrl) || PLACEHOLDER_COVER_URL;
    await cacheService.set("artwork", releaseId, fallback);
    return fallback;
  },
};
