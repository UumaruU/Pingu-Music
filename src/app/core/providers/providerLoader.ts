import { ProviderId } from "../../types";
import { ProviderModule } from "./providerTypes";

type ProviderLoader = () => Promise<ProviderModule>;

const disabledProviderFactory = (providerId: Exclude<ProviderId, "hitmos">): ProviderLoader => {
  return () => {
    if (providerId === "soundcloud") {
      return import("../../providers/soundcloud/soundcloudProvider");
    }

    return import("../../providers/telegram/telegramProvider");
  };
};

export const providerLoaders: Record<ProviderId, ProviderLoader> = {
  hitmos: () => import("../../providers/hitmos/hitmosProvider"),
  soundcloud: disabledProviderFactory("soundcloud"),
  telegram: disabledProviderFactory("telegram"),
};
