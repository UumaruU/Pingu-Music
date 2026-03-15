import { scheduleDeferredStartup } from "./deferredStartup";

export async function initializeApp(options: {
  cleanupListenHistory: () => void;
  loadPlayerService: () => Promise<{ initialize: () => void; hydrateFromStore: () => void }>;
  loadCacheService: () => Promise<{ cleanupExpired: () => Promise<void> }>;
  loadDownloadService: () => Promise<{ restoreDownloadsFromDisk: () => Promise<void> }>;
}) {
  options.cleanupListenHistory();

  const [playerService, cacheService, downloadService] = await Promise.all([
    options.loadPlayerService(),
    options.loadCacheService(),
    options.loadDownloadService(),
  ]);

  playerService.initialize();
  await downloadService.restoreDownloadsFromDisk();
  playerService.hydrateFromStore();
  scheduleDeferredStartup(() => {
    void cacheService.cleanupExpired();
  });
}
