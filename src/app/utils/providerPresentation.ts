import { ProviderId } from "../types";

interface ProviderPresentation {
  label: string;
  badgeClassName: string;
}

const providerPresentationById: Record<ProviderId, ProviderPresentation> = {
  hitmos: {
    label: "Hitmos",
    badgeClassName: "border-amber-300/25 bg-amber-300/10 text-amber-100/85",
  },
  lmusic: {
    label: "LMusic",
    badgeClassName: "border-cyan-300/30 bg-cyan-300/12 text-cyan-100/90",
  },
  soundcloud: {
    label: "SoundCloud",
    badgeClassName: "border-orange-300/25 bg-orange-300/10 text-orange-100/85",
  },
  telegram: {
    label: "Telegram",
    badgeClassName: "border-sky-300/25 bg-sky-300/10 text-sky-100/85",
  },
};

export function getProviderLabel(providerId: ProviderId) {
  return providerPresentationById[providerId]?.label ?? providerId;
}

export function getProviderBadgeClassName(providerId: ProviderId) {
  return (
    providerPresentationById[providerId]?.badgeClassName ??
    "border-white/10 bg-white/[0.04] text-white/65"
  );
}
