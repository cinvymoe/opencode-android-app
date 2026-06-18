# Android Patch Management

This document explains how Android-specific changes interact with the upstream web codebase and how to preserve them during syncs.

## Conflict Analysis

### ✅ Safe Changes (No Runtime Conflicts)

All Android-specific changes are **guarded by platform checks** and won't affect the web build:

| File | Change Type | Guard Mechanism | Conflict Risk |
|------|-------------|-----------------|---------------|
| `app/vite.js` | Build config | `VITE_PLATFORM=android` env var | Low |
| `app/src/components/titlebar.tsx` | Layout logic | `platform.platform === "android"` | Medium |
| `app/src/pages/layout.tsx` | Sidebar offset | Mobile checks | Medium |
| `app/src/pages/session/message-timeline.tsx` | Sticky header | CSS variables (default to 0) | Low |
| `app/src/app.tsx` | Theme callback | Optional prop (`onThemeApplied?`) | Low |
| `app/src/_android_entry.tsx` | New file | N/A (Android-only) | None |
| `app/src/_resolve_proxy.ts` | New file | N/A (Android-only) | None |
| `android/src/*` | Android source | N/A (Android-only) | None |
| `MainActivity.java` | Native code | N/A (Android-only) | None |

**Key Point**: The web build doesn't set `VITE_PLATFORM=android`, so all Android-specific code paths are inactive in web builds. The changes are **runtime-safe**.

### ⚠️ Potential Git Conflicts

While runtime-safe, these files could have **git merge conflicts** during upstream sync:

1. **`app/vite.js`** - If upstream modifies the Vite config or `transformIndexHtml` hooks
2. **`app/src/components/titlebar.tsx`** - If upstream refactors the titlebar layout
3. **`app/src/pages/layout.tsx`** - If upstream changes sidebar positioning
4. **`app/src/pages/session/message-timeline.tsx`** - If upstream modifies sticky header logic
5. **`app/src/app.tsx`** - If upstream adds new props to `AppBaseProviders`

## Patch Management Strategy

We use a patch-based workflow to maintain Android changes:

### Patch Files

1. **`001-shared-android-support.patch`** - Changes to shared `app/` files
   - Build system support (`app/vite.js`)
   - Titlebar Android layout (`titlebar.tsx`)
   - Sidebar positioning (`layout.tsx`)
   - Sticky header offsets (`message-timeline.tsx`)
   - Theme callback support (`app.tsx`)
   - Android entry proxy (`_android_entry.tsx`, `_resolve_proxy.ts`)

2. **`002-android-specific.patch`** - Android-only source files
   - `android/src/entry.tsx`
   - `android/src/platform.ts`
   - `android/src/styles/mobile.css`
   - `android/package.json`

3. **`003-native-android.patch`** - Native Android code
   - `MainActivity.java` (WindowInsets injection)

### Workflow

#### After Upstream Sync

```bash
cd android
./apply-patches.sh apply
```

This will:
1. Check if patches exist
2. Apply each patch in order
3. Report any conflicts

If conflicts occur:
```bash
# Check which files have conflicts
git status

# Resolve conflicts manually
# Then mark as resolved
git add <file>
```

#### After Making Android Changes

If you modify Android-related code, update the patches:

```bash
cd android
./apply-patches.sh create
```

This regenerates all patch files from the current git state.

### Alternative: Branch Strategy

If you prefer git branches over patches:

```bash
# Create Android branch from upstream main
git checkout -b android-upstream main

# Apply our Android changes
git cherry-pick <android-commits>

# To sync with upstream:
git checkout android-upstream
git rebase main
# Resolve any conflicts
```

## Recommended Upstream Contributions

Some changes are generic enough to be contributed upstream, reducing maintenance burden:

1. **`app/src/app.tsx` - `onThemeApplied` callback**
   - Generic enhancement useful for all platforms
   - Fully backward compatible (optional prop)

2. **`app/src/pages/session/message-timeline.tsx` - CSS variable offset**
   - Useful for any platform with dynamic headers
   - Default values maintain existing behavior

3. **`app/vite.js` - Platform-aware build system**
   - Could be extended to support multiple platforms
   - Currently only activates with explicit env var

## Prevention Checklist

Before each upstream sync, verify:

- [ ] Check if upstream modified `app/vite.js` (build config)
- [ ] Check if upstream modified `app/src/components/titlebar.tsx` (titlebar layout)
- [ ] Check if upstream modified `app/src/pages/layout.tsx` (sidebar positioning)
- [ ] Check if upstream modified `app/src/app.tsx` (AppBaseProviders props)
- [ ] Check if upstream modified theme/styling system

If any of these files have upstream changes, manual review of the patch application is recommended.
