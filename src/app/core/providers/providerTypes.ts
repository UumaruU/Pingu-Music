import { ProviderId, Track } from "../../types";

export interface MusicProvider {
  readonly id: ProviderId;
  search(query: string): Promise<Track[]>;
  getStream(trackId: string): Promise<string>;
}

export interface DiscoverableMusicProvider extends MusicProvider {
  getPopular?(): Promise<Track[]>;
}

export interface ProviderModule {
  createProvider: () => MusicProvider | DiscoverableMusicProvider;
}
