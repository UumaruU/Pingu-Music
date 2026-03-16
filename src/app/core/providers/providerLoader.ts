import { ProviderId } from "../../types";
import { ProviderModule } from "./providerTypes";

type ProviderLoader = () => Promise<ProviderModule>;

export const providerLoaders: Record<ProviderId, ProviderLoader> = {
  hitmos: () => import("../../providers/hitmos/hitmosProvider"),
  lmusic: () => import("../../providers/lmusic/lmusicProvider"),
  soundcloud: () => import("../../providers/soundcloud/soundcloudProvider"),
  telegram: () => import("../../providers/telegram/telegramProvider"),
};
