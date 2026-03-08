export function splitTrackArtists(value: string) {
  const normalized = value
    .replace(/\b(feat|ft)\.?\b/gi, ",")
    .replace(/\s+x\s+/gi, ",");

  const unique = new Set<string>();
  const artists = normalized
    .split(/,|&|;|\//g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .filter((part) => {
      const key = part.toLowerCase();

      if (unique.has(key)) {
        return false;
      }

      unique.add(key);
      return true;
    });

  return artists.length ? artists : [value.trim()].filter(Boolean);
}
