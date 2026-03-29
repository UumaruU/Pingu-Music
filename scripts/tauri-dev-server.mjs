import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const devUrl = process.env.TAURI_DEV_URL ?? "http://127.0.0.1:5173";
const viteMarkers = ["/@vite/client", "__vite_plugin_react_preamble_installed__", "<div id=\"root\"></div>"];
const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");

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

const child =
  process.platform === "win32"
    ? spawn("cmd.exe", ["/d", "/s", "/c", "npm run dev"], {
        stdio: "inherit",
        env: process.env,
        cwd: projectRoot,
      })
    : spawn("npm", ["run", "dev"], {
        stdio: "inherit",
        env: process.env,
        cwd: projectRoot,
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
