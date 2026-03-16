import { useEffect, useState } from "react";
import { CanonicalTrack, Track } from "../types";
import { TrackRow } from "./TrackRow";

interface CanonicalTrackListProps {
  tracksById: Record<string, Track>;
  canonicalTracks: CanonicalTrack[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlay: (trackId: string, queueIds: string[]) => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToPlaylist: (trackId: string) => void;
  onShowLyrics: (trackId: string) => void;
  onOpenArtist: (trackId: string, artistName?: string) => void;
}

function resolveDisplayTrack(canonicalTrack: CanonicalTrack, tracksById: Record<string, Track>) {
  const preferredTrackId = canonicalTrack.preferredVariantId ?? canonicalTrack.variantTrackIds[0];
  const variant = preferredTrackId ? tracksById[preferredTrackId] : null;

  if (!variant) {
    return null;
  }

  return {
    ...variant,
    title: canonicalTrack.title || variant.title,
    artist: canonicalTrack.artist || variant.artist,
    albumTitle: canonicalTrack.album ?? variant.albumTitle,
    coverUrl: canonicalTrack.coverUrl || variant.coverUrl,
    duration: canonicalTrack.targetDuration ?? variant.duration,
  } satisfies Track;
}

function buildCanonicalQueueIds(
  canonicalTracks: CanonicalTrack[],
  selectedCanonicalId: string,
  selectedTrackId: string,
) {
  return canonicalTracks
    .map((canonicalTrack) => {
      const defaultTrackId = canonicalTrack.preferredVariantId ?? canonicalTrack.variantTrackIds[0];

      if (!defaultTrackId) {
        return null;
      }

      return canonicalTrack.canonicalId === selectedCanonicalId
        ? selectedTrackId
        : defaultTrackId;
    })
    .filter((trackId): trackId is string => !!trackId);
}

function orderVariantTracks(tracks: Track[], preferredVariantId: string | null | undefined) {
  return [...tracks].sort((left, right) => {
    const leftIsPreferred = left.id === preferredVariantId ? 1 : 0;
    const rightIsPreferred = right.id === preferredVariantId ? 1 : 0;

    if (leftIsPreferred !== rightIsPreferred) {
      return rightIsPreferred - leftIsPreferred;
    }

    const leftPriority = left.sourcePriority ?? 0;
    const rightPriority = right.sourcePriority ?? 0;

    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }

    return left.id.localeCompare(right.id);
  });
}

export function CanonicalTrackList({
  tracksById,
  canonicalTracks,
  currentTrackId,
  isPlaying,
  onPlay,
  onToggleFavorite,
  onAddToPlaylist,
  onShowLyrics,
  onOpenArtist,
}: CanonicalTrackListProps) {
  const [expandedCanonicalIds, setExpandedCanonicalIds] = useState<string[]>([]);

  useEffect(() => {
    const availableCanonicalIds = new Set(canonicalTracks.map((track) => track.canonicalId));

    setExpandedCanonicalIds((currentIds) =>
      currentIds.filter((canonicalId) => availableCanonicalIds.has(canonicalId)),
    );
  }, [canonicalTracks]);

  function toggleCanonicalTrack(canonicalId: string) {
    setExpandedCanonicalIds((currentIds) =>
      currentIds.includes(canonicalId)
        ? currentIds.filter((id) => id !== canonicalId)
        : [...currentIds, canonicalId],
    );
  }

  return (
    <div className="space-y-0.5">
      {canonicalTracks.map((canonicalTrack, index) => {
        const displayTrack = resolveDisplayTrack(canonicalTrack, tracksById);

        if (!displayTrack) {
          return null;
        }

        const playableTrackId = canonicalTrack.preferredVariantId ?? displayTrack.id;
        const variantTracks = orderVariantTracks(
          canonicalTrack.variantTrackIds
            .map((trackId) => tracksById[trackId])
            .filter((track): track is Track => !!track),
          canonicalTrack.preferredVariantId,
        );
        const hasMultipleVariants = variantTracks.length > 1;
        const isClusterActive = currentTrackId
          ? canonicalTrack.variantTrackIds.includes(currentTrackId)
          : false;
        const shouldAutoExpand =
          !!currentTrackId &&
          variantTracks.some((track) => track.id === currentTrackId && track.id !== playableTrackId);
        const isExpanded =
          hasMultipleVariants &&
          (expandedCanonicalIds.includes(canonicalTrack.canonicalId) || shouldAutoExpand);
        const queueIds = buildCanonicalQueueIds(
          canonicalTracks,
          canonicalTrack.canonicalId,
          playableTrackId,
        );

        return (
          <div key={canonicalTrack.canonicalId} className="space-y-1.5">
            <TrackRow
              index={index + 1}
              track={displayTrack}
              isActive={isClusterActive}
              isPlaying={isClusterActive && isPlaying}
              metaBadge={
                hasMultipleVariants ? `${canonicalTrack.variantTrackIds.length} версии` : undefined
              }
              versionsExpanded={isExpanded}
              onToggleVersions={
                hasMultipleVariants ? () => toggleCanonicalTrack(canonicalTrack.canonicalId) : undefined
              }
              onPlay={() => onPlay(playableTrackId, queueIds)}
              onToggleFavorite={() => onToggleFavorite(playableTrackId)}
              onAddToPlaylist={() => onAddToPlaylist(playableTrackId)}
              onShowLyrics={() => onShowLyrics(playableTrackId)}
              onOpenArtist={(artistName) =>
                onOpenArtist(playableTrackId, artistName ?? canonicalTrack.artist)
              }
            />
            {isExpanded ? (
              <div className="ml-14 space-y-1 border-l border-white/10 pl-4">
                {variantTracks.map((variantTrack, variantIndex) => (
                  <TrackRow
                    key={variantTrack.id}
                    index={`${index + 1}.${variantIndex + 1}`}
                    nested
                    track={variantTrack}
                    isActive={currentTrackId === variantTrack.id}
                    isPlaying={currentTrackId === variantTrack.id && isPlaying}
                    metaBadge={variantTrack.id === playableTrackId ? "основной" : undefined}
                    onPlay={() =>
                      onPlay(
                        variantTrack.id,
                        buildCanonicalQueueIds(
                          canonicalTracks,
                          canonicalTrack.canonicalId,
                          variantTrack.id,
                        ),
                      )
                    }
                    onToggleFavorite={() => onToggleFavorite(variantTrack.id)}
                    onAddToPlaylist={() => onAddToPlaylist(variantTrack.id)}
                    onShowLyrics={() => onShowLyrics(variantTrack.id)}
                    onOpenArtist={(artistName) =>
                      onOpenArtist(variantTrack.id, artistName ?? variantTrack.artist)
                    }
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
