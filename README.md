# Pär Releases

Public release hosting for Pär Desktop.

This repository hosts signed (or unsigned beta) release artifacts and the Tauri updater manifest (`latest.json`) for the desktop app.

## What's here

- `latest.json` — Tauri updater manifest committed to `main`. This is the canonical updater endpoint and is also read by `datomer.eu` to resolve the latest download URL.
- Release assets attached to GitHub Releases, including:
  - macOS `.dmg` and `.app.tar.gz` bundles
  - Linux `.AppImage`
  - Windows `.exe` installer

## How releases are published

1. The app is built and optionally signed in the private `Pär` repository.
2. The release artifacts and `latest.json` are uploaded to a GitHub Release in this public repository.
3. The `publish-to-par-releases.yml` workflow in the private `Pär` repository also commits the rewritten `latest.json` to the root of this repo so the updater and public sites stay in sync.
4. The public landing page at `par-public` and the canonical marketing site at `datomer.eu` link to the macOS DMG asset URL.

## Do not store

- Source code
- Signing private keys
- License private keys
- Internal documentation
