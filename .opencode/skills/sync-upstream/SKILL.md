---
name: sync-upstream
description: |
  Sync opencode-android-app from upstream opencode monorepo (anomalyco/opencode).
  Extracts and remaps packages/core → core/, packages/app → app/,
  packages/ui → ui/, packages/sdk/js → sdk/, preserving android-specific
  modifications. Use when: "sync upstream", "更新上游", "同步 opencode",
  "pull upstream changes", "sync opencode version", "opencode更新了 如何同步".
  Voice triggers: "sync upstream", "pull from upstream", "update opencode version".
---

# /sync-upstream — Sync Android App from Upstream OpenCode Monorepo

Sync source code from the upstream [opencode monorepo](https://github.com/anomalyco/opencode) (tracked as `git remote upstream`) into the extracted Android app repo. The upstream uses a monorepo layout (`packages/*`), while this repo flattens to top-level (`core/`, `app/`, `ui/`, `sdk/`).

## Prerequisites

- Git remote `upstream` pointing to `git@github.com:anomalyco/opencode.git`
- Working tree clean (`git status` shows no changes)

## Directory Mapping

| Upstream (monorepo) | This repo |
|---|---|
| `packages/core/` | `core/` |
| `packages/app/` | `app/` |
| `packages/ui/` | `ui/` |
| `packages/sdk/js/` | `sdk/` |
| `patches/` | `patches/` |

## Step 1: Fetch Upstream

```bash
git fetch upstream
```

## Step 2: Determine Versions

Check current local versions vs upstream target:

```bash
echo "=== Local versions ==="
for pkg in core app ui sdk; do
  node -e "console.log(require('./${pkg}/package.json').version)" 2>/dev/null || echo "N/A"
done

echo "=== Upstream versions ==="
git show upstream/dev:packages/core/package.json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.version)"
```

The default sync target is `upstream/dev`. To sync a specific tag/commit, replace `upstream/dev` below with the desired ref.

## Step 3: Extract Upstream Packages

Use `git archive` to extract only the relevant packages into a temp directory:

```bash
TMPDIR="/tmp/opencode-upstream-sync"
rm -rf "$TMPDIR"
mkdir -p "$TMPDIR"

git archive upstream/dev -- \
  packages/core/src packages/core/package.json packages/core/tsconfig.json \
  | tar -x -C "$TMPDIR"

git archive upstream/dev -- \
  packages/sdk/js/src packages/sdk/js/package.json packages/sdk/js/tsconfig.json \
  | tar -x -C "$TMPDIR"

git archive upstream/dev -- \
  packages/app/src packages/app/package.json packages/app/tsconfig.json \
  packages/app/vite.config.ts packages/app/vite.js \
  packages/app/index.html packages/app/public packages/app/bunfig.toml \
  | tar -x -C "$TMPDIR"

git archive upstream/dev -- \
  packages/ui/src packages/ui/package.json packages/ui/tsconfig.json \
  packages/ui/vite.config.ts \
  | tar -x -C "$TMPDIR"

# Also extract root-level configs
git archive upstream/dev -- \
  package.json turbo.json tsconfig.json bunfig.toml patches \
  | tar -x -C "$TMPDIR"
```

Verify structure:

```bash
ls -la "$TMPDIR/packages/"
# Should show: app/ core/ sdk/ ui/
```

## Step 4: Remap to Flat Layout

Restructure the temp directory to match our flat layout:

```bash
REMAPDIR="/tmp/opencode-upstream-remap"
rm -rf "$REMAPDIR"
mkdir -p "$REMAPDIR"

# core
cp -r "$TMPDIR/packages/core/src"          "$REMAPDIR/core-src"
cp     "$TMPDIR/packages/core/package.json" "$REMAPDIR/core-package.json"
cp     "$TMPDIR/packages/core/tsconfig.json" "$REMAPDIR/core-tsconfig.json"

# sdk (nested: packages/sdk/js/)
cp -r "$TMPDIR/packages/sdk/js/src"           "$REMAPDIR/sdk-src"
cp     "$TMPDIR/packages/sdk/js/package.json"  "$REMAPDIR/sdk-package.json"
cp     "$TMPDIR/packages/sdk/js/tsconfig.json"  "$REMAPDIR/sdk-tsconfig.json"

# app
cp -r "$TMPDIR/packages/app/src"          "$REMAPDIR/app-src"
cp     "$TMPDIR/packages/app/package.json" "$REMAPDIR/app-package.json"
cp     "$TMPDIR/packages/app/tsconfig.json" "$REMAPDIR/app-tsconfig.json"
[ -d "$TMPDIR/packages/app/public" ]   && cp -r "$TMPDIR/packages/app/public" "$REMAPDIR/app-public"
[ -f "$TMPDIR/packages/app/vite.config.ts" ] && cp "$TMPDIR/packages/app/vite.config.ts" "$REMAPDIR/app-vite.config.ts"
[ -f "$TMPDIR/packages/app/vite.js" ]        && cp "$TMPDIR/packages/app/vite.js" "$REMAPDIR/app-vite.js"
[ -f "$TMPDIR/packages/app/index.html" ]     && cp "$TMPDIR/packages/app/index.html" "$REMAPDIR/app-index.html"
[ -f "$TMPDIR/packages/app/bunfig.toml" ]    && cp "$TMPDIR/packages/app/bunfig.toml" "$REMAPDIR/app-bunfig.toml"

# ui
cp -r "$TMPDIR/packages/ui/src"          "$REMAPDIR/ui-src"
cp     "$TMPDIR/packages/ui/package.json" "$REMAPDIR/ui-package.json"
cp     "$TMPDIR/packages/ui/tsconfig.json" "$REMAPDIR/ui-tsconfig.json"
[ -f "$TMPDIR/packages/ui/vite.config.ts" ] && cp "$TMPDIR/packages/ui/vite.config.ts" "$REMAPDIR/ui-vite.config.ts"
```

## Step 5: Rsync Source Files

**core/src/** — full sync (no android-specific code):

```bash
rsync -av --delete "$REMAPDIR/core-src/" core/src/
```

**sdk/src/** — full sync (API type definitions):

```bash
rsync -av --delete "$REMAPDIR/sdk-src/" sdk/src/
```

**ui/src/** — full sync:

```bash
rsync -av --delete "$REMAPDIR/ui-src/" ui/src/
```

**app/src/** — sync with backup (may contain android-specific code):

```bash
rsync -av --delete --backup --backup-dir=/tmp/opencode-app-backup \
  "$REMAPDIR/app-src/" app/src/
```

## Step 6: Restore Android-Specific Code

After rsync, restore android-specific modifications that were overwritten.

### 6a. platform.tsx — Add `"android"` to PlatformName and Platform type

In `app/src/context/platform.tsx`, after the upstream sync:

1. Change `type PlatformName = "web" | "desktop"` → `type PlatformName = "web" | "desktop" | "android"`

2. Add the android variant to the `Platform` union type:

```typescript
export type Platform = PlatformBase &
  (
    | { platform: "web"; os?: never }
    | {
        platform: "desktop"
        os?: DesktopOS
        openDirectoryPickerDialog(opts?: OpenDirectoryPickerOptions): Promise<PickerPaths>
      }
    | {
        platform: "android"
        os?: never
        /** Share content via Android Intent */
        share?(opts: { title?: string; text?: string; url?: string }): Promise<void>
        /** Handle Android back button */
        onBackPressed?(callback: () => boolean): () => void
        /** Get safe area insets */
        getSafeAreaInsets?(): { top: number; bottom: number; left: number; right: number }
        /** Set status bar style */
        setStatusBarStyle?(style: "dark" | "light"): Promise<void>
      }
  )
```

### 6b. Check other android-specific files

Find what got overwritten and may need manual merging:

```bash
grep -rl "android\|capacitor\|VITE_PLATFORM" /tmp/opencode-app-backup/ 2>/dev/null
```

Key files to review (may have `isMobile` / `platform.platform === "android"` patterns that need re-applying):

- `app/src/pages/session.tsx`
- `app/src/pages/layout.tsx`
- `app/src/components/titlebar.tsx`
- `app/src/components/session/session-header.tsx`

The upstream code significantly evolves these files each release, so android-specific UI accommodations (mobile-optimized layouts) may need to be rewritten rather than patch-applied.

## Step 7: Sync Config Files

Copy updated package.json and TypeScript config files:

```bash
REMAPDIR="/tmp/opencode-upstream-remap"

# Package.json files
cp "$REMAPDIR/core-package.json" core/package.json
cp "$REMAPDIR/sdk-package.json" sdk/package.json
cp "$REMAPDIR/app-package.json" app/package.json
cp "$REMAPDIR/ui-package.json" ui/package.json

# TypeScript configs
cp "$REMAPDIR/core-tsconfig.json" core/tsconfig.json
cp "$REMAPDIR/sdk-tsconfig.json" sdk/tsconfig.json
cp "$REMAPDIR/app-tsconfig.json" app/tsconfig.json
cp "$REMAPDIR/ui-tsconfig.json" ui/tsconfig.json

# Vite configs (if present)
[ -f "$REMAPDIR/app-vite.config.ts" ] && cp "$REMAPDIR/app-vite.config.ts" app/vite.config.ts
[ -f "$REMAPDIR/app-vite.js" ]        && cp "$REMAPDIR/app-vite.js" app/vite.js
[ -f "$REMAPDIR/ui-vite.config.ts" ]  && cp "$REMAPDIR/ui-vite.config.ts" ui/vite.config.ts
```

## Step 8: Sync Patches Directory

Compare patches and copy any new ones from upstream:

```bash
REMAPDIR="/tmp/opencode-upstream-remap"

# Copy new upstream patches that don't exist locally
for pf in "$REMAPDIR/patches"/*; do
  name=$(basename "$pf")
  if [ ! -f "patches/$name" ]; then
    cp "$pf" "patches/$name"
    echo "Added: patches/$name"
  fi
done

# Update existing patches if their content differs
for pf in "$REMAPDIR/patches"/*; do
  name=$(basename "$pf")
  if [ -f "patches/$name" ] && ! diff -q "patches/$name" "$pf" >/dev/null 2>&1; then
    cp "$pf" "patches/$name"
    echo "Updated: patches/$name"
  fi
done
```

## Step 9: Update Root package.json

The upstream monorepo uses bun's `catalog:` protocol in its package.json files. We need to:

### 9a. Add catalog to root package.json

```bash
node -e "
const p = require('./package.json');
const up = JSON.parse(require('fs').readFileSync('$REMAPDIR/package.json','utf8'));

// Preserve our workspace array
p.workspaces = ['app', 'ui', 'sdk', 'core', 'android'];

// Copy catalog from upstream root
p.catalog = up.workspaces.catalog;

// Update patchedDependencies to match upstream
p.patchedDependencies = up.patchedDependencies || p.patchedDependencies;

console.log(JSON.stringify(p, null, 2));
" > /tmp/root-pkg.json && cp /tmp/root-pkg.json package.json
```

### 9b. Remove server-only workspace deps from core/package.json

The core package declares dependencies on server-side packages we don't have:

```bash
node -e "
const p = require('./core/package.json');

// Remove server-only workspace dependencies
const serverDeps = [
  '@opencode-ai/effect-drizzle-sqlite',
  '@opencode-ai/effect-sqlite-node',
  '@opencode-ai/llm',
  '@opencode-ai/http-recorder',
];
serverDeps.forEach(d => {
  delete p.dependencies[d];
  delete p.peerDependencies?.[d];
  delete p.optionalDependencies?.[d];
  delete p.devDependencies?.[d];
});

// Update version to match upstream
const upVer = JSON.parse(require('fs').readFileSync('$REMAPDIR/core-package.json','utf8')).version;
p.version = upVer;

console.log(JSON.stringify(p, null, 2));
" > /tmp/core-pkg.json && cp /tmp/core-pkg.json core/package.json
```

## Step 10: Install Dependencies

Remove stale lockfile and reinstall:

```bash
rm -f bun.lock
bun install
```

If `bun install` fails with "Workspace dependency not found", search for the missing dependency:

```bash
grep -r "MISSING_PACKAGE_NAME" --include="*.json" \
  core/ sdk/ app/ ui/ package.json \
  2>/dev/null | grep -v node_modules
```

Remove it from whichever package.json section (dependencies, devDependencies, peerDependencies, optionalDependencies) it appears in, then retry.

## Step 11: Build and Verify

```bash
# Web build for android platform
VITE_PLATFORM=android bun run --cwd app build

# Sync to Android native project
cd android && bunx cap sync android
```

## Troubleshooting

### "fatal: refusing to merge unrelated histories"

The repos have no common git history (extracted, not forked). The `git merge` approach does not work. Always use the `git archive` → rsync approach described above.

### "catalog: failed to resolve"

The upstream packages use `catalog:` protocol. Ensure Step 9a added the `catalog` field to root `package.json`. Verify the catalog is readable:

```bash
node -e "const p=require('./package.json'); console.log('catalog entries:', Object.keys(p.catalog||{}).length)"
```

### Build fails with type errors after sync

Upstream package version bumps (e.g., `effect` 4.0.0-beta.66 → 4.0.0-beta.74) may require catalog updates. Check that the root `package.json` catalog matches the upstream root `package.json` `workspaces.catalog`.
