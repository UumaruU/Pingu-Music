import { cacheService } from "./cacheService";

interface CoverArtArchiveResponse {
  images?: Array<{
    front?: boolean;
    image?: string;
    thumbnails?: {
      large?: string;
      small?: string;
    };
  }>;
}

const PLACEHOLDER_COVER_URL = "https://placehold.co/300x300?text=Pingu+Music";

export const coverArtService = {
  async resolveCoverUrl(releaseId: string | undefined, sourceCoverUrl: string) {
    if (!releaseId) {
      return sourceCoverUrl || PLACEHOLDER_COVER_URL;
    }

    const cachedUrl = await cacheService.get<string>("artwork", releaseId);

    if (cachedUrl) {
      return cachedUrl;
    }

    try {
      const response = await fetch(`https://coverartarchive.org/release/${releaseId}`);

      if (response.ok) {
        const data = (await response.json()) as CoverArtArchiveResponse;
        const frontCover =
          data.images?.find((image) => image.front)?.thumbnails?.large ??
          data.images?.find((image) => image.front)?.image ??
          data.images?.[0]?.thumbnails?.large ??
          data.images?.[0]?.image;

        if (frontCover) {
          await cacheService.set("artwork", releaseId, frontCover);
          return frontCover;
        }
      }
    } catch {
      // Fall through to source cover.
    }

    const fallback = sourceCoverUrl || PLACEHOLDER_COVER_URL;
    await cacheService.set("artwork", releaseId, fallback);
    return fallback;
  },
};
