# Fix: Legacy Titlebar Buttons Appear Under Status Bar on Android

**Date**: 2026-06-15
**Status**: Approved

## Problem

On Android with the legacy (non-V2) titlebar design, the sidebar toggle button and other titlebar buttons appear partially inside the system status bar area instead of below it.

**Root cause**: The `<header>` element uses `padding-top: var(--sat)` to reserve space for the status bar, but the internal `grid` layout with `items-center` vertically centers buttons across the entire header height (including the padding area). This means buttons are visually centered within the combined padding + content space, placing them partially inside the status bar overlay.

The V2 titlebar does not have this issue because it uses `pt-2: !android()` on the inner content div, which pushes the content below the padding area.

## Solution: flex-col + spacer

Restructure the legacy titlebar `<header>` from a single-row `flex-row` with `padding-top` to a `flex-col` layout with a dedicated spacer div for the status bar area.

### Changes

**File**: `app/src/components/titlebar.tsx`

1. **Header element** (legacy + Android branch):
   - Change `flex-row` to `flex-col`
   - Remove `padding-top: var(--sat, 0px)` style
   - Change `overflow-hidden` to `overflow-visible` (Android only) to prevent clipping

2. **Add status bar spacer**:
   - Insert a `<Show when={android()}>` block with a `<div style={{ height: "var(--sat, 0px)" }} />` as the first child of the header
   - This spacer occupies the status bar space, pushing content below it

3. **Grid container**:
   - Change `h-full min-h-full` to `h-10 min-h-0` (fixed 40px height matching `legacyTitlebarHeight`)
   - Buttons center within this 40px grid, which sits entirely below the spacer

### Before/After Structure

```
BEFORE:
<header style="padding-top: var(--sat); min-height: calc(40px + var(--sat))">
  <div class="grid h-full items-center">  <!-- centers across full height including padding -->
    <button>☰</button>  <!-- visually inside status bar -->
  </div>
</header>

AFTER:
<header style="min-height: calc(40px + var(--sat))">
  <div style="height: var(--sat)" />      <!-- spacer for status bar -->
  <div class="grid h-10 items-center">    <!-- centers within 40px below spacer -->
    <button>☰</button>  <!-- visually below status bar -->
  </div>
</header>
```

### Impact

- **Legacy + Android**: Fixed — buttons now appear below the status bar
- **V2 + Android**: No change (uses different code path)
- **Desktop/Web**: No change (spacer not rendered when `android()=false`)
- **Click target**: `min-height` still includes `var(--sat)`, preserving clickability in the status bar area

## Verification

1. Legacy design + Android: sidebar toggle, nav buttons below status bar
2. V2 design + Android: unchanged behavior
3. Desktop (mac/windows/linux): unchanged behavior
4. Status bar area remains clickable (min-height preserved)
