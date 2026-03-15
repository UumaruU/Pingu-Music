export function scheduleDeferredStartup(task: () => void) {
  if (typeof window === "undefined") {
    task();
    return;
  }

  window.setTimeout(task, 0);
}
