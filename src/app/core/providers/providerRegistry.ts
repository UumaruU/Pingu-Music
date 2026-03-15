import { ProviderId } from "../../types";
import { providerLoaders } from "./providerLoader";
import { DiscoverableMusicProvider, MusicProvider } from "./providerTypes";

class ProviderRegistry {
  private readonly providers = new Map<ProviderId, MusicProvider | DiscoverableMusicProvider>();
  private readonly pendingLoads = new Map<
    ProviderId,
    Promise<MusicProvider | DiscoverableMusicProvider>
  >();

  async getProvider(providerId: ProviderId) {
    const cachedProvider = this.providers.get(providerId);

    if (cachedProvider) {
      return cachedProvider;
    }

    const pendingLoad = this.pendingLoads.get(providerId);

    if (pendingLoad) {
      return pendingLoad;
    }

    const loader = providerLoaders[providerId];

    if (!loader) {
      throw new Error(`Music provider "${providerId}" is not registered.`);
    }

    const loadTask = loader()
      .then((module) => {
        const provider = module.createProvider();
        this.providers.set(providerId, provider);
        return provider;
      })
      .finally(() => {
        this.pendingLoads.delete(providerId);
      });

    this.pendingLoads.set(providerId, loadTask);
    return loadTask;
  }
}

export const providerRegistry = new ProviderRegistry();
