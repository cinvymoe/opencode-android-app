---
name: sync-upstream
description: |
  Sync opencode-android-app from upstream opencode monorepo (anomalyco/opencode).
  Uses git merge with remapped tree to preserve Android modifications with proper
  conflict resolution. Use when: "sync upstream", "更新上游", "同步 opencode",
  "pull upstream changes", "sync opencode version", "opencode更新了 如何同步".
  Voice triggers: "sync upstream", "pull from upstream", "update opencode version".
---

# /sync-upstream — Sync Android App from Upstream OpenCode Monorepo

Sync source code from the upstream [opencode monorepo](https://github.com/anomalyco/opencode) (tracked as `git remote upstream`) into the Android app repo using **git merge** with a remapped tree. The upstream uses a monorepo layout (`packages/*`), while this repo flattens to top-level (`core/`, `app/`, `ui/`, `sdk/`).

## Prerequisites

- Git remote `upstream` pointing to `git@github.com:anomalyco/opencode.git`
- Working tree clean (`git status` shows no changes)
- Local tag matching the last synced version (e.g. `v1.17.4`) must be an ancestor of `main`

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

The default sync target is `upstream/dev`. To sync a specific tag, replace `upstream/dev` below.

Identify the local tag for the last sync point (e.g. `v1.17.4`). This tag must be an ancestor of `main`:

```bash
git merge-base --is-ancestor v1.17.4 main && echo "OK: v1.17.4 is ancestor of main"
```

## Step 3: Build Remapped Upstream Tree

Create a git tree object that remaps the upstream monorepo structure to our flat layout. This is done entirely with git plumbing commands — no working tree changes.

### 3a. Prepare modified root package.json

```bash
git show upstream/dev:package.json > /tmp/upstream-root-pkg.json

node -e "
const p = require('/tmp/upstream-root-pkg.json');
p.workspaces = {
  packages: ['app', 'ui', 'sdk', 'core', 'android'],
  catalog: p.workspaces.catalog
};
// Remove scripts that don't apply to our repo
delete p.scripts['dev:desktop'];
delete p.scripts['dev:console'];
delete p.scripts['dev:stats'];
delete p.scripts['dev:storybook'];
delete p.scripts['upgrade-opentui'];
delete p.scripts['sso'];
// Remove workspace deps we don't have
delete p.dependencies['@opencode-ai/plugin'];
delete p.dependencies['@opencode-ai/script'];
// Fix postinstall path
p.scripts['postinstall'] = 'bun run --cwd core fix-node-pty';
console.log(JSON.stringify(p, null, 2));
" > /tmp/modified-root-pkg.json

MODIFIED_PKG_BLOB=$(git hash-object -w /tmp/modified-root-pkg.json)
```

### 3b. Prepare modified core/package.json (remove server-only deps)

```bash
git show upstream/dev:packages/core/package.json > /tmp/upstream-core-pkg.json

node -e "
const p = require('/tmp/upstream-core-pkg.json');
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
console.log(JSON.stringify(p, null, 2));
" > /tmp/modified-core-pkg.json

MODIFIED_CORE_PKG_BLOB=$(git hash-object -w /tmp/modified-core-pkg.json)
```

### 3c. Build the remapped tree

```bash
# Build modified core tree (replace package.json)
NEW_CORE_TREE=$({
  git ls-tree upstream/dev:packages/core | grep -v 'package.json$'
  printf "100644 blob %s\tpackage.json\n" "$MODIFIED_CORE_PKG_BLOB"
} | git mktree)

# Get tree SHAs for other packages (used as-is)
APP_TREE=$(git rev-parse upstream/dev:packages/app)
UI_TREE=$(git rev-parse upstream/dev:packages/ui)
SDK_JS_TREE=$(git rev-parse upstream/dev:packages/sdk/js)
PATCHES_TREE=$(git rev-parse upstream/dev:patches)

# Get tree/blob SHAs from our repo that are not in upstream
ANDROID_TREE=$(git rev-parse HEAD:android)
DOCS_TREE=$(git rev-parse HEAD:docs)
SCRIPTS_TREE=$(git rev-parse HEAD:scripts)
GITIGNORE_BLOB=$(git rev-parse HEAD:.gitignore)

# Get root config blobs from upstream
TSCONFIG_BLOB=$(git rev-parse upstream/dev:tsconfig.json)
BUNFIG_BLOB=$(git rev-parse upstream/dev:bunfig.toml)
TURBO_BLOB=$(git rev-parse upstream/dev:turbo.json)
LICENSE_BLOB=$(git rev-parse upstream/dev:LICENSE)
README_BLOB=$(git rev-parse upstream/dev:README.md)

# Get preserved trees from our last sync tag
CHANGELOG_BLOB=$(git rev-parse LAST_SYNC_TAG:CHANGELOG.md 2>/dev/null)

# Build top-level tree
SYNC_TREE=$({
  printf "100644 blob %s\t.gitignore\n" "$GITIGNORE_BLOB"
  printf "040000 tree %s\tandroid\n" "$ANDROID_TREE"
  printf "040000 tree %s\tapp\n" "$APP_TREE"
  printf "100644 blob %s\tbunfig.toml\n" "$BUNFIG_BLOB"
  [ -n "$CHANGELOG_BLOB" ] && printf "100644 blob %s\tCHANGELOG.md\n" "$CHANGELOG_BLOB"
  printf "040000 tree %s\tcore\n" "$NEW_CORE_TREE"
  printf "040000 tree %s\tdocs\n" "$DOCS_TREE"
  printf "100644 blob %s\tLICENSE\n" "$LICENSE_BLOB"
  printf "100644 blob %s\tpackage.json\n" "$MODIFIED_PKG_BLOB"
  printf "040000 tree %s\tpatches\n" "$PATCHES_TREE"
  printf "100644 blob %s\tREADME.md\n" "$README_BLOB"
  printf "040000 tree %s\tscripts\n" "$SCRIPTS_TREE"
  printf "040000 tree %s\tsdk\n" "$SDK_JS_TREE"
  printf "100644 blob %s\ttsconfig.json\n" "$TSCONFIG_BLOB"
  printf "100644 blob %s\tturbo.json\n" "$TURBO_BLOB"
  printf "040000 tree %s\tui\n" "$UI_TREE"
} | git mktree)

echo "Remapped tree: $SYNC_TREE"
```

## Step 4: Create Sync Commit and Branch

Create a commit on top of the last sync tag, then a branch:

```bash
SYNC_COMMIT=$(git commit-tree "$SYNC_TREE" -p LAST_SYNC_TAG -m "upstream: remap upstream/dev to flat layout (vNEW_VERSION)")

git branch upstream-sync-NEW_VERSION "$SYNC_COMMIT"
```

Example for v1.17.4 → v1.17.9:

```bash
SYNC_COMMIT=$(git commit-tree "$SYNC_TREE" -p v1.17.4 -m "upstream: remap upstream/dev to flat layout (v1.17.9)")
git branch upstream-sync-1.17.9 "$SYNC_COMMIT"
```

## Step 5: Merge into Main

```bash
git merge --no-commit --no-ff upstream-sync-NEW_VERSION
```

This performs a proper 3-way merge with `LAST_SYNC_TAG` as the merge base, automatically preserving our Android-specific commits while applying upstream changes.

## Step 6: Resolve Merge Conflicts

If there are conflicts, resolve them. In the v1.17.4→1.17.9 sync, only `app/src/app.tsx` had a conflict.

### Conflict Resolution Rules

When resolving conflicts, **always prefer the upstream refactoring** but **preserve Android-specific additions**:

1. **`app/src/app.tsx`** — Upstream refactored providers (e.g. `AppShellProviders` → `SharedProviders` + `ServerScopedShell`). Keep the new upstream structure but add back:
   - `RouterRoot` component with `appChildren` and `mobileShell` props
   - `onThemeApplied` callback in `AppBaseProviders`
   - `mobileShell` prop in `AppInterface`
   - `ServerKey` wrapping `ServerShell` in the router root

   **IMPORTANT**: `RouterRoot` should be a simple fragment wrapper (no provider), because server-scoped providers (`ServerScopedShell`) now live inside route layouts:
   ```tsx
   function RouterRoot(props: ParentProps<{ appChildren?: JSX.Element; mobileShell?: JSX.Element }>) {
     return (
       <>
         {props.appChildren}
         {props.children}
         {props.mobileShell}
       </>
     )
   }
   ```

2. **Other files** (titlebar.tsx, layout.tsx, message-timeline.tsx, vite.js) — These usually merge cleanly via git's 3-way merge. Verify Android modifications are preserved after merge.

## Step 7: Restore Android-Only Files

If the merge deleted Android-only files that don't exist upstream, restore them from HEAD:

```bash
git checkout HEAD -- \
  app/src/components/sync-status-bar.tsx \
  app/src/context/sync-status.tsx \
  app/src/hooks/use-refresh-action.ts
```

## Step 8: Verify Android Modifications Preserved

After merge, check that ALL Android-specific code is present:

```bash
echo "=== app.tsx ==="
grep -c "onThemeApplied\|mobileShell\|RouterRoot" app/src/app.tsx

echo "=== titlebar.tsx ==="
grep -c "android" app/src/components/titlebar.tsx

echo "=== layout.tsx ==="
grep -c "android\|safe-area" app/src/pages/layout.tsx

echo "=== message-timeline.tsx ==="
grep -c "android\|safe-area" app/src/pages/session/timeline/message-timeline.tsx

echo "=== vite.js ==="
grep -c "android\|VITE_PLATFORM" app/vite.js

echo "=== platform.tsx ==="
grep -c "android" app/src/context/platform.tsx

echo "=== server-sync.tsx ==="
grep -c "visibilitychange" app/src/context/server-sync.tsx

echo "=== server-sdk.tsx ==="
grep -c "status," app/src/context/server-sdk.tsx

echo "=== queue.ts ==="
grep -c "isDraining" app/src/context/global-sync/queue.ts
```

If any check returns 0, the Android modification was lost. See Step 9.

## Step 9: Re-apply Lost Android Modifications

If git merge overwrote Android modifications (because the upstream changed the same lines), manually re-apply them:

### platform.tsx — Add "android" to PlatformName + android platform type

```tsx
type PlatformName = "web" | "desktop" | "android"

export type Platform = PlatformBase &
  (
    | { platform: "web"; os?: never }
    | { platform: "desktop"; os?: DesktopOS; openDirectoryPickerDialog(opts?: OpenDirectoryPickerOptions): Promise<PickerPaths> }
    | {
        platform: "android"
        os?: never
        openDirectoryPickerDialog?(opts?: OpenDirectoryPickerOptions): Promise<PickerPaths>
        openFilePickerDialog?(opts?: OpenAttachmentPickerOptions): Promise<PickerPaths>
        share?(opts: { title?: string; text?: string; url?: string }): Promise<void>
        onBackPressed?(callback: () => boolean): () => void
        getSafeAreaInsets?(): { top: number; bottom: number; left: number; right: number }
        setStatusBarStyle?(style: "dark" | "light"): Promise<void>
      }
  )
```

### server-sync.tsx — Add visibilitychange handler

Add import:
```tsx
import { makeEventListener } from "@solid-primitives/event-listener"
```

Add after the `createEffect` block that starts SSE:
```tsx
makeEventListener(document, "visibilitychange", () => {
  if (document.visibilityState !== "visible") return
  const status = serverSDK.status()
  if (status !== "connected") {
    queue.refresh()
  }
})
```

### server-sdk.tsx — Export status signal

In the return object of `createServerSdkContextBase`, add `status`:
```tsx
return {
  scope,
  url: server.http.url,
  client: sdk,
  status,  // ← Android: expose status signal
  event: { ... },
  ...
}
```

### global-sync/queue.ts — Add isDraining signal

Add import:
```tsx
import { createSignal } from "solid-js"
```

Add signal declaration:
```tsx
const [isDraining, setIsDraining] = createSignal(false)
```

Set in `drain()`:
```tsx
async function drain() {
  if (running) return
  running = true
  setIsDraining(true)
  // ...
}
```

Clear in `finally`:
```tsx
} finally {
  running = false
  setIsDraining(false)
  // ...
}
```

Export in return:
```tsx
return {
  push,
  refresh,
  clear(directory: string) { ... },
  dispose() { ... },
  isDraining,  // ← Android: expose draining state
}
```

## Step 10: Commit the Merge

```bash
git add -A
git commit -m "Merge upstream vNEW_VERSION into Android app"
```

## Step 11: Fix Root package.json

If needed, fix root package.json for our flat workspace layout:

```bash
node -e "
const p = require('./package.json');
// Remove workspace deps we don't have
delete p.dependencies['@opencode-ai/plugin'];
delete p.dependencies['@opencode-ai/script'];
// Fix postinstall path
p.scripts['postinstall'] = 'bun run --cwd core fix-node-pty';
console.log(JSON.stringify(p, null, 2));
" > /tmp/root-pkg-fixed.json && cp /tmp/root-pkg-fixed.json package.json

git add package.json
git commit -m "fix: update root package.json for flat workspace layout"
```

## Step 12: Install Dependencies

```bash
rm -f bun.lock
bun install
```

If `bun install` fails with "Workspace dependency not found", find and remove the missing dependency:

```bash
grep -r "MISSING_PACKAGE_NAME" --include="*.json" \
  core/ sdk/ app/ ui/ package.json \
  2>/dev/null | grep -v node_modules
```

## Step 13: Update Version Numbers

Update `android/package.json` and `android/android/app/build.gradle` to match the new upstream version:

```bash
NEW_VERSION="1.17.9"  # Replace with actual version

# android/package.json
node -e "
const p = require('./android/package.json');
p.version = '$NEW_VERSION';
console.log(JSON.stringify(p, null, 2));
" > /tmp/android-pkg.json && cp /tmp/android-pkg.json android/package.json
```

For `android/android/app/build.gradle`, update:
```groovy
versionCode 11709    // MAJOR*10000 + MINOR*100 + PATCH
versionName "1.17.9"
```

## Step 14: Build and Verify

```bash
# Web build for android platform
VITE_PLATFORM=android bun run --cwd app build

# Sync to Android native project
cd android && bunx cap sync android
```

## Step 15: Commit Version Update and Push

```bash
git add -A
git commit -m "fix: bump version to NEW_VERSION (android package.json + build.gradle)"
git push origin main
```

## Step 16: Update Sync Tag

Create a new tag for the current sync point (for use as merge base in future syncs):

```bash
git tag -a vNEW_VERSION -m "sync: upstream vNEW_VERSION"
git push origin vNEW_VERSION
```

Example:
```bash
git tag -a v1.17.9 -m "sync: upstream v1.17.9"
git push origin v1.17.9
```

---

## Android Modifications Reference

This is the complete list of Android-specific modifications that must be preserved across syncs:

### New Files (Android-only, not in upstream)

| File | Purpose |
|---|---|
| `app/src/_android_entry.tsx` | Android-specific app entry point |
| `app/src/_resolve_proxy.ts` | Android module resolution proxy |
| `app/src/components/sync-status-bar.tsx` | Android sync status bar UI |
| `app/src/context/sync-status.tsx` | Android sync status context |
| `app/src/hooks/use-refresh-action.ts` | Android pull-to-refresh hook |
| `android/` | Entire Android native project directory |

### Modified Files (Android patches to upstream code)

| File | Modification |
|---|---|
| `app/src/app.tsx` | `RouterRoot` with `appChildren`/`mobileShell` props; `onThemeApplied` callback in `AppBaseProviders`; `mobileShell` prop in `AppInterface`; `ServerKey` wrapping `ServerShell` in router root |
| `app/src/components/titlebar.tsx` | Android platform detection; status bar height with `--sat` safe-area; conditional class names for android |
| `app/src/pages/layout.tsx` | Android sidebar positioning with safe-area insets (`calc(40px + var(--sat, 0px))`) |
| `app/src/pages/session/timeline/message-timeline.tsx` | Sticky header with android safe-area insets |
| `app/src/vite.js` | Android entry path (`_android_entry.tsx`); `VITE_PLATFORM` define; `@android` alias; crossorigin attribute stripping |
| `app/src/context/platform.tsx` | `"android"` in `PlatformName`; android platform type with native APIs (`openDirectoryPickerDialog`, `openFilePickerDialog`, `share`, `onBackPressed`, `getSafeAreaInsets`, `setStatusBarStyle`) |
| `app/src/context/server-sync.tsx` | `visibilitychange` handler for reconnection on Android (import `makeEventListener` from `@solid-primitives/event-listener`) |
| `app/src/context/server-sdk.tsx` | Export `status` signal in return object |
| `app/src/context/global-sync/queue.ts` | `isDraining` signal (import `createSignal` from `solid-js`, set true in `drain()`, false in `finally`, export) |
| `android/src/platform.ts` | `createAndroidPlatform()` with Capacitor APIs |
| `android/src/entry.tsx` | Android-specific entry point |
| `android/package.json` | Version must match upstream release |
| `android/android/app/build.gradle` | `versionCode` and `versionName` must match upstream release |

## Troubleshooting

### "catalog: failed to resolve"

The upstream packages use `catalog:` protocol. Ensure the root `package.json` has the `workspaces.catalog` field from upstream:

```bash
node -e "const p=require('./package.json'); console.log('catalog entries:', Object.keys(p.workspaces?.catalog||{}).length)"
```

### "Workspace dependency not found"

We don't have all upstream packages. Remove workspace deps that reference missing packages:

```bash
# Common missing packages
node -e "
const p = require('./package.json');
delete p.dependencies['@opencode-ai/plugin'];
delete p.dependencies['@opencode-ai/script'];
// Fix postinstall path
p.scripts['postinstall'] = 'bun run --cwd core fix-node-pty';
console.log(JSON.stringify(p, null, 2));
" > /tmp/root-pkg-fixed.json && cp /tmp/root-pkg-fixed.json package.json
```

### Build fails with "AppShellProviders is not defined"

Upstream refactored `AppShellProviders` into `SharedProviders` + `ServerScopedShell`. `RouterRoot` should NOT wrap children in `ServerScopedShell` — it should be a simple fragment. The server-scoped providers are provided by the route layouts (`SelectedServerLayout`, `DraftServerLayout`).

### Build fails with "ServerSDK context must be used within a context provider"

`RouterRoot` must NOT add provider wrappers (`ServerScopedShell`, `AppShellProviders`, etc.) because it renders at the router level, before `ServerSDKProvider` is available. Use a fragment (`<>...</>`) instead.

### "v0.0.0" shown in app title

Update `android/package.json` version and `android/android/app/build.gradle` `versionName` to match the upstream release version (Step 13).

### message-timeline.tsx moved to new path

Upstream moved `app/src/pages/session/message-timeline.tsx` to `app/src/pages/session/timeline/message-timeline.tsx`. The Android safe-area insets modifications should be in the new location.
