const titleNoisePatterns = [
  /\((?:feat|ft)\.?.*?\)/gi,
  /\[(?:feat|ft)\.?.*?\]/gi,
  /\b(?:feat|ft)\.?\s+.+$/gi,
  /\bremix\b/gi,
  /\bedit\b/gi,
  /\blive\b/gi,
  /\bslowed\b/gi,
  /\breverb\b/gi,
];

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function cleanupDelimiters(value: string) {
  // Normalize hyphen/en-dash/em-dash spacing.
  return value.replace(/\s*[-–—]\s*/g, " - ").replace(/[(){}\[\]]/g, " ");
}

function stripNoise(value: string) {
  return titleNoisePatterns.reduce((result, pattern) => result.replace(pattern, " "), value);
}

function normalizeText(value: string) {
  return normalizeWhitespace(
    cleanupDelimiters(stripNoise(value))
      .normalize("NFKC")
      .toLowerCase(),
  );
}

export function extractPrimaryArtistName(rawArtist: string) {
  return (
    rawArtist
      .replace(/\b(feat|ft)\.?\b/gi, ",")
      .split(/,|&|;| x /i)
      .map((part) => part.trim())
      .find(Boolean) || rawArtist.trim()
  );
}

export const normalizationService = {
  normalizeArtistName(artist: string) {
    return normalizeText(artist);
  },

  normalizeTrackTitle(title: string) {
    return normalizeText(title);
  },
};
