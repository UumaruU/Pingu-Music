import { spawn } from "node:child_process";

const devUrl = process.env.TAURI_DEV_URL ?? "http://127.0.0.1:5173";
const viteMarkers = ["/@vite/client", "__vite_plugin_react_preamble_installed__", "<div id=\"root\"></div>"];

async function hasCompatibleDevServer() {
  try {
    const response = await fetch(devUrl, {
      signal: AbortSignal.timeout(1500),
    });

    if (!response.ok) {
      return false;
    }

    const body = await response.text();
    return viteMarkers.some((marker) => body.includes(marker));
  } catch {
    return false;
  }
}

if (await hasCompatibleDevServer()) {
  console.log(`[tauri-dev] reusing frontend dev server at ${devUrl}`);
  process.exit(0);
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(npmCommand, ["run", "dev"], {
  stdio: "inherit",
  env: process.env,
});

child.on("error", (error) => {
  console.error("[tauri-dev] failed to start frontend dev server");
  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
