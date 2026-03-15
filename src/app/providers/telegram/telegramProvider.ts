import { MusicProvider } from "../../core/providers/providerTypes";
import { Track } from "../../types";

class TelegramProvider implements MusicProvider {
  readonly id = "telegram" as const;

  async search(_query: string): Promise<Track[]> {
    throw new Error("Telegram provider is not enabled in this build.");
  }

  async getStream(_trackId: string): Promise<string> {
    throw new Error("Telegram provider is not enabled in this build.");
  }
}

export function createProvider() {
  return new TelegramProvider();
}
