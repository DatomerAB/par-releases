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

## Shared Runner Selection

The callable workflow `.github/workflows/select-runner.yml` provides runner
selection for Datomer repositories. Callers must pin it to a published commit
SHA and pass `self_hosted_labels` as a JSON array and `github_hosted_label` as
the compatible hosted platform. Its outputs are `runs_on` (JSON), `runner_kind`,
and `reason`.

- `runner_preference`: `self-hosted-preferred` (default) or `github-hosted`.
- `wait_minutes`: 0 to 30, default 30. Zero performs one availability check;
  choosing `github-hosted` bypasses the check and wait.
- `runner_check_token`: an optional fine-grained token with repository
  Administration: read for the calling repository. Without access, selection
  falls back to hosted immediately with a reason. Organization runners must
  also be assigned to runner groups accessible to that repository.

A brief Ubuntu-hosted bootstrap checks availability. The selector then runs
on a matching idle self-hosted runner, or on Ubuntu while polling. Hosted
polling consumes hosted minutes; the availability budget includes bootstrap
elapsed time. Self-hosted controllers must support the Node runtime used by
the pinned `actions/github-script` action. Fork-origin pull request and
`workflow_run` events always use hosted runners, and no caller code is checked
out by the selector.

This checks availability before assignment, not queue-time failover. A runner
can become unavailable between checking it and starting either the selector
or the work job. GitHub cannot automatically relocate an assigned job. Runtime
failures do not retry publishing, deployment, or email jobs on another runner.

Run the mocked tests with Node and a Python interpreter containing PyYAML:

```bash
PYTHON=python3 node --test .github/tests/select-runner.test.cjs
actionlint .github/workflows/select-runner.yml
```

## Do not store

- Source code
- Signing private keys
- License private keys
- Internal documentation
