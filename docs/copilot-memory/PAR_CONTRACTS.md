# Contract with DatomerAB/Par

This repo is a public mirror. Do not edit files manually except in emergencies.

## What Pär publishes here

- Signed DMG assets from `DatomerAB/Par` releases.
- `latest.json` — Tauri updater manifest.
- `model-catalog-latest.json` — model catalog bundle manifest.
- `model-catalog-<timestamp>.zip` bundles.

## Source of truth

- `DatomerAB/Par` is the source of truth for all content.
- Binaries come from `.github/workflows/publish-to-par-releases.yml` in Pär.
- Catalog bundles come from `.github/workflows/publish-model-catalog.yml` in Pär.

## Do not

- Commit `latest.json` manually unless fixing a broken automation.
- Rename or delete releases created by Pär automation.
- Add models or licenses here directly.

## Breakage playbook

- If `latest.json` is wrong, fix the source workflow in Pär and re-run it.
- If a release is missing, check `DatomerAB/Par` actions first.

## Change impact checklist

- [ ] If Pär changes the dispatch payload, update this file and verify the
      downstream workflows still handle it.
- [ ] If the catalog bundle shape changes, update `par-public` and `datomer.eu`
      memory files.
