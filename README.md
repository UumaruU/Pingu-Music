
# Pingu Music

Desktop music player on `Tauri + React + TypeScript`.

## Технологии

- `React 18`
- `TypeScript`
- `Vite`
- `Tauri 2`
- `Zustand`

## Требования (Windows)

- `Node.js 20+`
- `npm 10+`
- `Rust stable` (`rustup`, `cargo`, `rustc`)
- `Visual Studio Build Tools 2022`:
  - workload `Desktop development with C++`
  - `MSVC v143`
  - `Windows 10/11 SDK`

## Установка

```powershell
npm ci
```

## Запуск в браузере (только frontend)

```powershell
npm run dev
```

## Запуск как desktop-приложение (Tauri dev)

```powershell
npm run tauri:dev
```

## Сборка релиза

Собрать release-приложение:

```powershell
npm run tauri:build
```

Обычно это дает portable exe:

- `src-tauri\target\release\pingu-music.exe`

Собрать именно установщик NSIS:

```powershell
npm run tauri:build -- --bundles nsis
```

Готовый установщик:

- `src-tauri\target\release\bundle\nsis\Pingu Music_0.1.0_x64-setup.exe`

## Публикация на GitHub

1. Пушишь исходники в репозиторий.
2. Создаешь `Release` (например, тег `v0.1.0`).
3. Прикрепляешь:
   - `...x64-setup.exe` (установщик)
   - опционально `pingu-music.exe` (portable)

## Частые ошибки на Windows

### `rustup/cargo/rustc` не найден

- Установи Rust: https://rustup.rs/
- Закрой и открой терминал заново.

### `link.exe not found`

- Не установлен C++ toolchain из Build Tools.
- Запусти терминал `x64 Native Tools Command Prompt for VS 2022` и собирай из него.

### Собирается только `pingu-music.exe`, но нет установщика

- Укажи bundle явно:

```powershell
npm run tauri:build -- --bundles nsis
```

### В PowerShell команда `npm` работает нестабильно

Используй:

```powershell
npm.cmd run tauri:build
```

## Структура проекта

- `src/` — frontend (React)
- `src-tauri/` — Rust/Tauri shell
- `src-tauri/target/release/` — выходные бинарники release-сборки
