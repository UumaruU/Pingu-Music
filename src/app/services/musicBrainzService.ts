import { Artist, Release } from "../types";

interface MusicBrainzArtistCreditDto {
  name: string;
  artist?: {
    id: string;
    name: string;
  };
}

interface MusicBrainzReleaseGroupDto {
  id: string;
  title?: string;
  "primary-type"?: string;
}

interface MusicBrainzReleaseDto {
  id: string;
  title: string;
  date?: string;
  country?: string;
  status?: string;
  "release-group"?: MusicBrainzReleaseGroupDto;
  "artist-credit"?: MusicBrainzArtistCreditDto[];
}

interface MusicBrainzRecordingDto {
  id: string;
  score: number;
  title: string;
  "first-release-date"?: string;
  "artist-credit"?: MusicBrainzArtistCreditDto[];
  releases?: MusicBrainzReleaseDto[];
}

interface MusicBrainzRecordingsResponse {
  recordings?: MusicBrainzRecordingDto[];
}

interface MusicBrainzArtistSearchDto {
  id: string;
  name: string;
  score?: number;
  type?: string;
  country?: string;
  disambiguation?: string;
}

interface MusicBrainzArtistsResponse {
  artists?: MusicBrainzArtistSearchDto[];
}

interface MusicBrainzArtistDto {
  id: string;
  name: string;
  type?: string;
  country?: string;
  disambiguation?: string;
  area?: { name: string };
  "begin-area"?: { name: string };
  "life-span"?: {
    begin?: string;
    end?: string;
  };
  tags?: Array<{ name: string }>;
}

interface MusicBrainzReleaseLookupDto extends MusicBrainzReleaseDto {}

interface MusicBrainzReleaseListResponse {
  releases?: MusicBrainzReleaseDto[];
  "release-count"?: number;
}

interface MusicBrainzReleaseTrackDto {
  id: string;
  title: string;
  recording?: {
    id: string;
    title: string;
  };
}

interface MusicBrainzReleaseMediaDto {
  tracks?: MusicBrainzReleaseTrackDto[];
}

interface MusicBrainzReleaseDetailsDto extends MusicBrainzReleaseDto {
  media?: MusicBrainzReleaseMediaDto[];
}

export interface RecordingMatch {
  recordingId: string;
  title: string;
  score: number;
  artistId?: string;
  artistName?: string;
  releaseId?: string;
  releaseGroupId?: string;
  releaseTitle?: string;
  releaseDate?: string;
  releaseCountry?: string;
}

export interface ArtistMatch {
  id: string;
  name: string;
  score: number;
  type?: string;
  country?: string;
  disambiguation?: string;
}

interface ArtistDiscography {
  albums: Release[];
  singles: Release[];
}

interface ReleaseTrackListing {
  release: Release;
  trackTitles: string[];
}

const MUSICBRAINZ_BASE_URL = "https://musicbrainz.org/ws/2";
const MIN_REQUEST_INTERVAL = 1000;

function mapReleaseKind(primaryType: string | undefined): Release["kind"] {
  const normalizedType = (primaryType ?? "").trim().toLowerCase();

  if (normalizedType === "album") {
    return "album";
  }

  if (normalizedType === "single" || normalizedType === "ep") {
    return "single";
  }

  return "other";
}

function toTimestamp(value: string | undefined) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return Number.NEGATIVE_INFINITY;
  }

  return parsed;
}

function getReleaseQualityWeight(release: MusicBrainzReleaseDto) {
  let weight = 0;

  if ((release.status ?? "").toLowerCase() === "official") {
    weight += 4;
  }

  if (release.country) {
    weight += 1;
  }

  if (release.date) {
    weight += release.date.length >= 10 ? 3 : 1;
  }

  return weight;
}

function isBetterReleaseVariant(next: MusicBrainzReleaseDto, current: MusicBrainzReleaseDto) {
  const nextWeight = getReleaseQualityWeight(next);
  const currentWeight = getReleaseQualityWeight(current);

  if (nextWeight !== currentWeight) {
    return nextWeight > currentWeight;
  }

  return toTimestamp(next.date) > toTimestamp(current.date);
}

function mapRelease(release: MusicBrainzReleaseDto, artistId?: string): Release {
  const releaseGroup = release["release-group"];
  const artistName = release["artist-credit"]?.[0]?.artist?.name ?? release["artist-credit"]?.[0]?.name;

  return {
    id: release.id,
    title: releaseGroup?.title ?? release.title,
    musicBrainzReleaseId: release.id,
    musicBrainzReleaseGroupId: releaseGroup?.id,
    artistId,
    artistName,
    kind: mapReleaseKind(releaseGroup?.["primary-type"]),
    date: release.date,
    country: release.country,
  };
}

class MusicBrainzService {
  private lastRequestStartedAt = 0;

  private async throttle() {
    const elapsed = Date.now() - this.lastRequestStartedAt;

    if (elapsed < MIN_REQUEST_INTERVAL) {
      await new Promise((resolve) => window.setTimeout(resolve, MIN_REQUEST_INTERVAL - elapsed));
    }

    this.lastRequestStartedAt = Date.now();
  }

  private async request<T>(path: string, query: Record<string, string | number>) {
    await this.throttle();
    const url = new URL(`${MUSICBRAINZ_BASE_URL}/${path}`);

    url.searchParams.set("fmt", "json");

    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, `${value}`);
    });

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "PinguMusic/0.1.0 (pingu-music@example.com)",
      },
    });

    if (!response.ok) {
      throw new Error(`MusicBrainz returned ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  private escapeLuceneValue(value: string) {
    return value.replace(/([\\"])/g, "\\$1");
  }

  async searchRecording(title: string, artist: string) {
    const query = `recording:"${this.escapeLuceneValue(title)}" AND artist:"${this.escapeLuceneValue(artist)}"`;
    const response = await this.request<MusicBrainzRecordingsResponse>("recording/", {
      query,
      limit: 5,
      inc: "releases+artist-credits",
    });

    return (response.recordings ?? []).map<RecordingMatch>((recording) => {
      const primaryArtist = recording["artist-credit"]?.[0];
      const release = recording.releases?.[0];

      return {
        recordingId: recording.id,
        title: recording.title,
        score: recording.score,
        artistId: primaryArtist?.artist?.id,
        artistName: primaryArtist?.artist?.name ?? primaryArtist?.name,
        releaseId: release?.id,
        releaseGroupId: release?.["release-group"]?.id,
        releaseTitle: release?.title ?? release?.["release-group"]?.title,
        releaseDate: release?.date ?? recording["first-release-date"],
        releaseCountry: release?.country,
      };
    });
  }

  async searchArtist(name: string): Promise<ArtistMatch[]> {
    const response = await this.request<MusicBrainzArtistsResponse>("artist/", {
      query: `artist:"${this.escapeLuceneValue(name)}"`,
      limit: 8,
    });

    return (response.artists ?? []).map((artist) => ({
      id: artist.id,
      name: artist.name,
      score: artist.score ?? 0,
      type: artist.type,
      country: artist.country,
      disambiguation: artist.disambiguation,
    }));
  }

  async getArtist(artistId: string): Promise<Artist> {
    const response = await this.request<MusicBrainzArtistDto>(`artist/${artistId}`, {
      inc: "tags",
    });

    return {
      id: response.id,
      name: response.name,
      musicBrainzArtistId: response.id,
      type: response.type,
      country: response.country,
      area: response.area?.name,
      beginArea: response["begin-area"]?.name,
      disambiguation: response.disambiguation || undefined,
      beginDate: response["life-span"]?.begin,
      endDate: response["life-span"]?.end,
      tags: response.tags?.map((tag) => tag.name).slice(0, 8),
    };
  }

  async getRelease(releaseId: string): Promise<Release> {
    const response = await this.request<MusicBrainzReleaseLookupDto>(`release/${releaseId}`, {
      inc: "artist-credits",
    });

    return mapRelease(response);
  }

  async getArtistDiscography(artistId: string): Promise<ArtistDiscography> {
    const bestByReleaseGroup = new Map<string, MusicBrainzReleaseDto>();
    let offset = 0;

    while (offset < 300) {
      const response = await this.request<MusicBrainzReleaseListResponse>("release/", {
        artist: artistId,
        status: "official",
        limit: 100,
        offset,
        inc: "release-groups+artist-credits",
      });
      const releases = response.releases ?? [];

      if (!releases.length) {
        break;
      }

      for (const release of releases) {
        const kind = mapReleaseKind(release["release-group"]?.["primary-type"]);

        if (kind === "other") {
          continue;
        }

        const dedupeKey = release["release-group"]?.id ?? release.id;
        const existing = bestByReleaseGroup.get(dedupeKey);

        if (!existing || isBetterReleaseVariant(release, existing)) {
          bestByReleaseGroup.set(dedupeKey, release);
        }
      }

      if (releases.length < 100) {
        break;
      }

      offset += releases.length;
    }

    const selectedReleases = Array.from(bestByReleaseGroup.values())
      .map((release) => mapRelease(release, artistId))
      .sort((left, right) => toTimestamp(right.date) - toTimestamp(left.date));

    return {
      albums: selectedReleases.filter((release) => release.kind === "album"),
      singles: selectedReleases.filter((release) => release.kind === "single"),
    };
  }

  async getReleaseTrackListing(releaseId: string): Promise<ReleaseTrackListing> {
    const response = await this.request<MusicBrainzReleaseDetailsDto>(`release/${releaseId}`, {
      inc: "recordings+artist-credits",
    });
    const trackTitles = (response.media ?? [])
      .flatMap((medium) => medium.tracks ?? [])
      .map((track) => (track.recording?.title ?? track.title).trim())
      .filter(Boolean);

    return {
      release: mapRelease(response),
      trackTitles,
    };
  }
}

export const musicBrainzService = new MusicBrainzService();
