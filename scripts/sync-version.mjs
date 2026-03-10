import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const versionConfigPath = path.join(rootDir, "src", "app", "config", "app-version.json");
const packageJsonPath = path.join(rootDir, "package.json");
const packageLockPath = path.join(rootDir, "package-lock.json");
const tauriConfigPath = path.join(rootDir, "src-tauri", "tauri.conf.json");
const cargoTomlPath = path.join(rootDir, "src-tauri", "Cargo.toml");

const versionConfig = JSON.parse(fs.readFileSync(versionConfigPath, "utf8"));
const version = String(versionConfig.version ?? "").trim();

if (!version) {
  throw new Error("app-version.json must contain a non-empty version");
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
if (packageJson.version !== version) {
  packageJson.version = version;
  writeJson(packageJsonPath, packageJson);
}

if (fs.existsSync(packageLockPath)) {
  const packageLock = JSON.parse(fs.readFileSync(packageLockPath, "utf8"));
  packageLock.version = version;

  if (packageLock.packages?.[""]) {
    packageLock.packages[""].version = version;
  }

  writeJson(packageLockPath, packageLock);
}

const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, "utf8"));
if (tauriConfig.version !== version) {
  tauriConfig.version = version;
  writeJson(tauriConfigPath, tauriConfig);
}

const cargoToml = fs.readFileSync(cargoTomlPath, "utf8");
const nextCargoToml = cargoToml.replace(
  /(\[package\][\s\S]*?^version\s*=\s*")[^"]+(")/m,
  `$1${version}$2`,
);

if (nextCargoToml !== cargoToml) {
  fs.writeFileSync(cargoTomlPath, nextCargoToml, "utf8");
}

console.log(`[version] synced ${version}`);
