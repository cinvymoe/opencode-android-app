# Refresh & Auto-Sync Design

**Date**: 2026-06-10
**Status**: Draft
**Scope**: opencode-android-app (SolidJS + Capacitor Android)

## Summary

Add a refresh button to the top navigation bar and enhance auto-sync behavior after network reconnection, with a sync status indicator bar. No pull-to-refresh gesture.

## Requirements

1. **Refresh button** in the top titlebar (right side) that triggers context-aware data refresh
2. **Auto-sync on reconnection** — when SSE reconnects after disconnection, ensure all data is refreshed
3. **Sync status indicator** — a thin bar below the titlebar showing connection/sync state
4. **No pull-to-refresh gesture** — only button-triggered refresh

## Architecture

### Component 1: Refresh Button

**Location**: Titlebar right side, next to existing action buttons.

**Behavior**: Context-aware refresh based on current page:

| Page | Refresh Action | API Called |
|------|---------------|-----------|
| Home | Re-bootstrap global data + refresh all active directory session lists | `queue.refresh()` + `loadSessions()` for each active directory |
| Session | Force-refresh current session messages, diff, and todo | `sync.session.sync(id, {force:true})` + `sync.session.diff(id, {force:true})` + `sync.session.todo(id, {force:true})` |
| Settings | No refresh button (settings data is locally persisted) | — |

**Visual feedback**:
- Default: refresh icon (V2 icon system `refresh`)
- Refreshing: icon rotates via CSS `animation: spin`
- Complete: icon stops rotating

**Implementation**:
- New `useRefreshAction()` hook returning `{ refresh, isRefreshing }`
- Hook determines current page context and calls appropriate sync APIs
- Button added to `titlebar.tsx`

### Component 2: Auto-Sync on Reconnection

**Existing mechanism** (no changes needed):
- `server-sdk.tsx`: SSE auto-reconnects with 250ms delay, 15s heartbeat timeout
- `server-sync.tsx:388-394`: `server.connected` event triggers `queue.push()` for all active directories
- `server-sync.tsx:379`: `global.disposed` event triggers `bootstrap.refetch()`

**Enhancements**:

1. **Proactive sync on `visibilitychange`** in `layout.tsx`: When `visibilitychange` detects the page becoming visible and the SSE stream is stale (last event received > heartbeat timeout), call `serverSync.project.loadSessions()` for all active directories and `bootstrap.refetch()` for global data, directly bypassing the `recent` guard in `server-sync.tsx:376`. The `recent` guard is kept — it prevents duplicate event storms during initial boot, and the `visibilitychange` handler in `layout.tsx` calls `queue.refresh()` explicitly rather than relying on the SSE event listener path. `layout.tsx` already has a `visibilitychange` handler (line 242) for sidebar hiding; this enhancement adds sync-triggering logic there.

2. **Global data refetch** as part of the same `visibilitychange` handler: In addition to `queue.refresh()`, call `bootstrap.refetch()` via the `useServerSync()` context to immediately refresh global config, providers, and project data without waiting for SSE reconnection to complete.

3. **Session page resume sync**: When page returns from background with an active session, call `sync.session.sync(id, {force: true})` to ensure messages are current.

**What stays unchanged**:
- SSE reconnection logic (heartbeat, reconnect delay)
- Refresh queue deduplication/pause/batch mechanism

### Component 3: Sync Status Indicator

**New `SyncStatusBar` component** showing SSE connection and data sync state.

**State machine**:

```
disconnected → connecting → syncing → synced
                                  ↑       ↓ (new events arrive)
                                  ←←←←←←←
```

| State | Trigger | UI |
|-------|---------|-----|
| `disconnected` | SSE heartbeat timeout / network error | Yellow bar, text "连接已断开…" |
| `connecting` | SSE reconnecting | Yellow bar + spinning icon, text "重新连接…" |
| `syncing` | SSE reconnected + refresh queue draining, or user clicked refresh | Blue bar + spinning icon, text "同步中…" |
| `synced` | Refresh queue drain complete | Green bar, text "已同步", auto-hide after 1.5s |

**Position**: Full-width bar below titlebar, height ~28px

**Detection**:
- `disconnected` / `connecting`: From `server-sdk.tsx` SSE connection state (needs new `status` signal)
- `syncing` / `synced`: From `queue.ts` drain state (needs new `isDraining` signal)

**Implementation**:
- `server-sdk.tsx`: Add `status` signal: `"connected" | "disconnected" | "connecting"`
- `queue.ts`: Add `isDraining` signal: `boolean`
- New `useSyncStatus()` hook combining both signals into `SyncStatus`
- New `SyncStatusBar` component consuming the hook
- Mount `SyncStatusBar` in `layout.tsx` or `app.tsx`

## Files to Modify

| File | Change |
|------|--------|
| `app/src/context/server-sdk.tsx` | Expose `status` signal for SSE connection state |
| `app/src/context/global-sync/queue.ts` | Expose `isDraining` signal for queue drain state |
| `app/src/context/server-sync.tsx` | Expose `useSyncStatus()` hook; enhance `visibilitychange` handling |
| `app/src/components/titlebar.tsx` | Add refresh button with spinning animation |
| `app/src/components/sync-status-bar.tsx` | New file — sync status indicator component |
| `app/src/hooks/use-refresh-action.ts` | New file — context-aware refresh hook |
| `app/src/pages/layout.tsx` | Mount `SyncStatusBar`; add `visibilitychange` proactive sync |
| `app/src/pages/session.tsx` | Add session resume sync on visibility change |

## Data Flow

```
User clicks refresh button
  → useRefreshAction() determines page context
  → Home: queue.refresh() + loadSessions()
  → Session: sync.session.sync(id, {force:true}) + diff + todo
  → isRefreshing signal → button spinning animation

SSE disconnects (heartbeat timeout / network error)
  → server-sdk.tsx: status = "disconnected"
  → SyncStatusBar shows "连接已断开…"

SSE reconnects
  → server-sdk.tsx: status = "connecting" → "connected"
  → server-sync.tsx: server.connected event → queue.push() all directories
  → queue.ts: isDraining = true
  → SyncStatusBar shows "同步中…"

Queue drain completes
  → queue.ts: isDraining = false
  → SyncStatusBar shows "已同步" → 1.5s → auto-hide

Page becomes visible (from background)
  → visibilitychange handler
  → If SSE stale: queue.refresh() + bootstrap.refetch()
  → If active session: sync.session.sync(id, {force:true})
```

## Error Handling

- **Refresh button**: If refresh fails, stop spinning animation and show a toast with error message (using existing `showToast` utility)
- **Auto-sync failure**: SSE reconnection already has retry logic. If bootstrap fails, existing error handling in `bootstrap.ts` shows toast per directory
- **SyncStatusBar**: If sync fails, status bar transitions from `syncing` back to `disconnected`, showing the error state

## Testing

- Unit tests for `useRefreshAction()` hook (page context detection, API call selection)
- Unit tests for `useSyncStatus()` hook (state transitions)
- Unit tests for `SyncStatusBar` component (rendering per state, auto-hide)
- E2E test: refresh button on Home page triggers session list reload
- E2E test: refresh button on Session page triggers message reload
- E2E test: network disconnection shows status bar, reconnection shows sync then auto-hide
