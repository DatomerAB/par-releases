# Pär Releases

Public release hosting for Pär Desktop.

This repository hosts signed (or unsigned beta) release artifacts and the Tauri updater manifest (`latest.json`) for the macOS desktop app.

## What's here

- `latest.json` — Tauri updater manifest
- `.dmg` release assets attached to GitHub Releases

## How releases are published

1. The app is built and optionally signed in the private `Pär` repository.
2. The resulting `.dmg` and `latest.json` are uploaded to a release in this public repository.
3. The public landing page at `par-public` links to the DMG asset URL.

## Do not store

- Source code
- Signing private keys
- License private keys
- Internal documentation
