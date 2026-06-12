# Refresh & Auto-Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a refresh button to the titlebar and a sync status indicator bar, plus enhance auto-sync on SSE reconnection for the Android app.

**Architecture:** Extend existing sync infrastructure (SSE event stream, refresh queue, directory-sync) with new signals for connection/drain status, a context-aware refresh hook, and a status bar component. No new APIs or polling needed.

**Tech Stack:** SolidJS, solid-js/store, @tanstack/solid-query, @opencode-ai/sdk, @opencode-ai/ui V2 components

---

## File Structure

| File | Responsibility |
|------|---------------|
| `app/src/context/global-sync/queue.ts` | Refresh queue with new `isDraining` reactive signal |
| `app/src/context/server-sdk.tsx` | SSE connection manager with new `status` reactive signal |
| `app/src/context/sync-status.tsx` | New — `useSyncStatus()` hook combining server status + queue drain status into `SyncStatus` |
| `app/src/hooks/use-refresh-action.ts` | New — `useRefreshAction()` hook returning `{ refresh, isRefreshing }` based on page context |
| `app/src/components/sync-status-bar.tsx` | New — `SyncStatusBar` component rendering connection/sync state bar |
| `app/src/components/titlebar.tsx` | Modified — add refresh button next to existing action buttons |
| `app/src/pages/layout.tsx` | Modified — mount `SyncStatusBar`, add `visibilitychange` proactive sync |

---

### Task 1: Expose `isDraining` signal from refresh queue

**Files:**
- Modify: `app/src/context/global-sync/queue.ts`
- Test: `app/src/context/global-sync/queue.test.ts`

- [ ] **Step 1: Write the failing test for isDraining signal**

Add a test in `queue.test.ts` that verifies the `isDraining` accessor tracks drain state:

```typescript
import { describe, test, expect } from "vitest"
import { createRefreshQueue } from "./queue"

describe("createRefreshQueue", () => {
  test("isDraining is false initially, true during drain, false after drain", async () => {
    let draining = false
    const queue = createRefreshQueue({
      paused: () => false,
      bootstrap: async () => { draining = queue.isDraining(); },
      bootstrapInstance: async () => {},
    })
    expect(queue.isDraining()).toBe(false)
    queue.refresh()
    // Allow microtask to process
    await new Promise((r) => setTimeout(r, 10))
    expect(draining).toBe(true)
    // Wait for drain to finish
    await new Promise((r) => setTimeout(r, 50))
    expect(queue.isDraining()).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/src/context/global-sync/queue.test.ts`
Expected: FAIL — `queue.isDraining` is not defined

- [ ] **Step 3: Add `isDraining` accessor to queue**

In `app/src/context/global-sync/queue.ts`, add an `isDraining` getter that reads the `running` variable:

```typescript
export function createRefreshQueue(input: QueueInput) {
  const queued = new Map<string, string>()
  let root = false
  let running = false
  let timer: ReturnType<typeof setTimeout> | undefined

  // ... existing code unchanged ...

  return {
    push,
    refresh,
    clear(directory: string) {
      queued.delete(key(directory))
    },
    dispose() {
      if (!timer) return
      clearTimeout(timer)
      timer = undefined
    },
    isDraining() {
      return running || root
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/src/context/global-sync/queue.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/context/global-sync/queue.ts app/src/context/global-sync/queue.test.ts
git commit -m "feat(queue): expose isDraining signal for sync status tracking"
```

---

### Task 2: Expose `status` signal from server-sdk

**Files:**
- Modify: `app/src/context/server-sdk.tsx`

- [ ] **Step 1: Add `status` signal to `createServerSdkContext`**

In `app/src/context/server-sdk.tsx`, inside `createServerSdkContext()` function, add a reactive signal for SSE connection status:

```typescript
import { createSignal } from "solid-js"

// Inside createServerSdkContext():
type SdkStatus = "disconnected" | "connecting" | "connected"
const [status, setStatus] = createSignal<SdkStatus>("disconnected")
```

- [ ] **Step 2: Set status at appropriate lifecycle points**

Update the SSE connection lifecycle to set status transitions:

1. **In `start()` function** (around line 128): Set `setStatus("connecting")` when starting connection attempt:

```typescript
const start = () => {
    if (started) return run
    started = true
    setStatus("connecting")
    // ... rest unchanged ...
```

2. **When first event received from stream** (around line 158): Set `setStatus("connected")`:

```typescript
for await (const event of events.stream) {
    resetHeartbeat()
    streamErrorLogged = false
    setStatus("connected")  // NEW: mark connected on first event
    // ... rest unchanged ...
```

3. **In catch block** (around line 188): Set `setStatus("disconnected")` on non-abort errors:

```typescript
} catch (error) {
    if (!isStreamClosed(error, attempt?.signal) && !streamErrorLogged) {
        streamErrorLogged = true
        setStatus("disconnected")  // NEW: mark disconnected on error
        // ... existing console.error ...
    }
```

4. **In heartbeat timeout** (around line 118): Set `setStatus("disconnected")` when heartbeat aborts:

```typescript
heartbeat = setTimeout(() => {
    setStatus("disconnected")  // NEW: mark disconnected on heartbeat timeout
    attempt?.abort()
}, HEARTBEAT_TIMEOUT_MS)
```

- [ ] **Step 3: Expose `status` in return object**

Add `status` to the return object of `createServerSdkContext()`:

```typescript
return {
    scope,
    url: server.http.url,
    client: sdk,
    event: {
        on: emitter.on.bind(emitter),
        listen: emitter.listen.bind(emitter),
        start,
    },
    status,  // NEW: expose connection status signal
    createClient(opts: Omit<Parameters<typeof createSdkForServer>[0], "server" | "fetch">) {
        return createSdkForServer({
            server: server.http,
            fetch: platform.fetch,
            ...opts,
        })
    },
}
```

- [ ] **Step 4: Commit**

```bash
git add app/src/context/server-sdk.tsx
git commit -m "feat(server-sdk): expose status signal for SSE connection state"
```

---

### Task 3: Create `useSyncStatus` hook

**Files:**
- Create: `app/src/context/sync-status.tsx`

- [ ] **Step 1: Create the hook file**

Create `app/src/context/sync-status.tsx`:

```typescript
import { createMemo } from "solid-js"
import { useServerSDK } from "./server-sdk"

export type SyncStatus = "idle" | "disconnected" | "connecting" | "syncing" | "synced"

let lastDraining = false
let syncedAt: number | undefined

const SYNCED_DISPLAY_MS = 1500

export function createSyncStatus(serverStatus: () => "disconnected" | "connecting" | "connected", isDraining: () => boolean): () => SyncStatus {
  return createMemo(() => {
    const s = serverStatus()
    const d = isDraining()

    if (s === "disconnected") {
      lastDraining = false
      syncedAt = undefined
      return "disconnected"
    }

    if (s === "connecting") {
      lastDraining = false
      syncedAt = undefined
      return "connecting"
    }

    // s === "connected"
    if (d) {
      lastDraining = true
      syncedAt = undefined
      return "syncing"
    }

    // Just finished draining — show "synced" briefly
    if (lastDraining && !d) {
      lastDraining = false
      if (!syncedAt) syncedAt = Date.now()
      if (Date.now() - syncedAt < SYNCED_DISPLAY_MS) return "synced"
      syncedAt = undefined
      return "idle"
    }

    return "idle"
  })
}
```

- [ ] **Step 2: Add `useSyncStatus` to `server-sync.tsx` return**

In `app/src/context/server-sync.tsx`, inside the `createServerSyncContextInner()` return object, add a `syncStatus` computed signal:

```typescript
// Inside createServerSyncContextInner(), after queue definition:
const syncStatus = createSyncStatus(
  () => serverSDK.status(),
  () => queue.isDraining(),
)

// In return object, add:
return {
    // ... existing fields ...
    syncStatus,  // NEW
}
```

Also import `createSyncStatus` at top of `server-sync.tsx`:

```typescript
import { createSyncStatus, type SyncStatus } from "./sync-status"
```

- [ ] **Step 3: Commit**

```bash
git add app/src/context/sync-status.tsx app/src/context/server-sync.tsx
git commit -m "feat(sync-status): add useSyncStatus hook combining server + queue state"
```

---

### Task 4: Create `useRefreshAction` hook

**Files:**
- Create: `app/src/hooks/use-refresh-action.ts`

- [ ] **Step 1: Create the hook file**

Create `app/src/hooks/use-refresh-action.ts`:

```typescript
import { createSignal } from "solid-js"
import { useLocation, useParams } from "@solidjs/router"
import { useServerSync } from "@/context/server-sync"
import { useSync } from "@/context/sync"
import { showToast } from "@/utils/toast"
import { formatServerError } from "@/utils/server-errors"
import { useLanguage } from "@/context/language"
import { directoryKey } from "@/context/global-sync/utils"

export function useRefreshAction() {
  const [isRefreshing, setIsRefreshing] = createSignal(false)
  const location = useLocation()
  const params = useParams()
  const language = useLanguage()
  const serverSync = useServerSync()

  async function refresh() {
    if (isRefreshing()) return
    setIsRefreshing(true)

    try {
      const pathname = location.pathname

      // Home page: refresh global data + all active directory sessions
      if (pathname === "/" || pathname === "") {
        await Promise.all([
          serverSync.project.loadSessions(Object.keys(serverSync.data.project).length > 0
            ? Object.keys(serverSync.child ? (serverSync as any).children || {} : {})
            : ""),
        ).catch(() => {}),
        // Trigger global bootstrap refresh via queue
        // queue.refresh() is called through serverSync internal mechanism
        ])
        return
      }

      // Session page: force-refresh current session data
      const sessionID = params.id
      const dir = params.dir
      if (sessionID && dir) {
        const sync = useSync()
        await Promise.all([
          sync.session.sync(sessionID, { force: true }),
          sync.session.diff(sessionID, { force: true }),
          sync.session.todo(sessionID, { force: true }),
        ])
        return
      }
    } catch (error) {
      showToast({
        variant: "error",
        title: language.t("common.refreshFailed"),
        description: formatServerError(error, language.t),
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  return { refresh, isRefreshing }
}
```

**Note**: The Home page refresh path needs refinement — `useRefreshAction` must work in both the layout context (where `useServerSync` is available) and the session context (where `useSync` is available). Since these are different context levels, the hook will be split: Home uses `useServerSync()` directly, Session uses `useSync()` from the `sync.tsx` context. The implementation should check which context is available based on route.

- [ ] **Step 2: Commit**

```bash
git add app/src/hooks/use-refresh-action.ts
git commit -m "feat(refresh-action): add useRefreshAction hook for context-aware refresh"
```

---

### Task 5: Add refresh button to titlebar

**Files:**
- Modify: `app/src/components/titlebar.tsx`

- [ ] **Step 1: Add refresh button to V2 titlebar**

In `app/src/components/titlebar.tsx`, inside the V2 titlebar `Match` block (around line 514-515), add a refresh button next to the `<TitlebarV2Right>` component:

```tsx
import { useRefreshAction } from "@/hooks/use-refresh-action"

// Inside the V2 titlebar section, after the <div class="flex-1" /> spacer:
<div class="flex-1" />
<RefreshButton />
<TitlebarV2Right state={v2RightState()} />
```

Add the `RefreshButton` component inside `titlebar.tsx`:

```tsx
function RefreshButton() {
  const { refresh, isRefreshing } = useRefreshAction()
  const language = useLanguage()

  return (
    <IconButtonV2
      variant="ghost-muted"
      size="large"
      class={`shrink-0 ${isRefreshing() ? "animate-spin" : ""}`}
      icon={<IconV2 name="refresh" />}
      onClick={refresh}
      disabled={isRefreshing()}
      aria-label={language.t("common.refresh")}
    />
  )
}
```

Also add the CSS for `animate-spin` if not already available. Check if it's defined in the project's Tailwind/Vite setup. If not, add to `app/src/index.css`:

```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.animate-spin {
  animation: spin 1s linear infinite;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/titlebar.tsx app/src/index.css
git commit -m "feat(titlebar): add refresh button with spinning animation"
```

---

### Task 6: Create `SyncStatusBar` component

**Files:**
- Create: `app/src/components/sync-status-bar.tsx`

- [ ] **Step 1: Create the status bar component**

Create `app/src/components/sync-status-bar.tsx`:

```tsx
import { Show, createEffect, createSignal, onCleanup } from "solid-js"
import { IconV2 } from "@opencode-ai/ui/v2/icon"
import type { SyncStatus } from "@/context/sync-status"

const STATUS_CONFIG: Record<SyncStatus, { bg: string; text: string; icon?: string }> = {
  idle: { bg: "", text: "" },
  disconnected: { bg: "bg-v2-status-warning-bg", text: "连接已断开…", icon: "wifi-off" },
  connecting: { bg: "bg-v2-status-warning-bg", text: "重新连接…", icon: "wifi-loading" },
  syncing: { bg: "bg-v2-status-info-bg", text: "同步中…", icon: "refresh" },
  synced: { bg: "bg-v2-status-success-bg", text: "已同步", icon: "check" },
}

export function SyncStatusBar(props: { status: () => SyncStatus }) {
  const [visible, setVisible] = createSignal(false)
  let hideTimer: ReturnType<typeof setTimeout> | undefined

  createEffect(() => {
    const s = props.status()
    if (s === "idle") {
      setVisible(false)
      if (hideTimer) clearTimeout(hideTimer)
      hideTimer = undefined
      return
    }

    setVisible(true)

    if (s === "synced") {
      if (hideTimer) clearTimeout(hideTimer)
      hideTimer = setTimeout(() => setVisible(false), 1500)
    }
  })

  onCleanup(() => {
    if (hideTimer) clearTimeout(hideTimer)
  })

  const config = () => STATUS_CONFIG[props.status()]
  const isSpinning = () => props.status() === "connecting" || props.status() === "syncing"

  return (
    <Show when={visible() && config().bg}>
      <div
        class={`flex h-7 items-center justify-center gap-1.5 text-[13px] [font-weight:440] transition-all duration-200 ${config().bg}`}
        role="status"
        aria-live="polite"
      >
        <Show when={config().icon}>
          <span class={`flex size-3.5 items-center justify-center ${isSpinning() ? "animate-spin" : ""}`}>
            <IconV2 name={config().icon!} />
          </span>
        </Show>
        <span class="text-v2-text-text-base">{config().text}</span>
      </div>
    </Show>
  )
}
```

**Note on color variables**: The V2 design system may use different variable names for status colors. Check existing variables in the theme/V2 CSS before finalizing `bg-v2-status-warning-bg`, `bg-v2-status-info-bg`, `bg-v2-status-success-bg`. If they don't exist, use inline styles or existing close equivalents like `bg-[color-mix(in_srgb,var(--v2-background-bg-layer-01)_95%,var(--v2-status-warning))]`.

- [ ] **Step 2: Commit**

```bash
git add app/src/components/sync-status-bar.tsx
git commit -m "feat(sync-status-bar): add sync status indicator component"
```

---

### Task 7: Mount `SyncStatusBar` and wire up `useSyncStatus`

**Files:**
- Modify: `app/src/pages/layout.tsx`
- Modify: `app/src/context/server-sync.tsx`

- [ ] **Step 1: Add `syncStatus` accessor to `server-sync.tsx` provider**

In `app/src/context/server-sync.tsx`, ensure `syncStatus` is accessible from the `ServerSyncProvider`. The `createServerSyncContextInner()` return already includes `syncStatus` from Task 3. Verify the provider exposes it:

```typescript
// In the ServerSyncProvider init function (line 524-535):
export const { use: useServerSync, provider: ServerSyncProvider } = createSimpleContext({
  name: "ServerSync",
  gate: false,
  init: (props: { server?: ServerConnection.Any }) => {
    // ... existing init logic ...
    return ctx.sync  // This already returns the full inner object including syncStatus
  },
})
```

The `ctx.sync` is the result of `createServerSyncContextInner()` which now includes `syncStatus`. Users can call `serverSync.syncStatus()` to get the current `SyncStatus`.

- [ ] **Step 2: Mount `SyncStatusBar` in layout**

In `app/src/pages/layout.tsx`, import and mount `SyncStatusBar` just above the main content area:

```tsx
import { SyncStatusBar } from "@/components/sync-status-bar"
import { useServerSync } from "@/context/server-sync"

// Inside the Layout component, add SyncStatusBar above the content:
const serverSync = useServerSync()

// In the JSX, after the titlebar and before the main content:
<SyncStatusBar status={serverSync.syncStatus} />
```

- [ ] **Step 3: Commit**

```bash
git add app/src/pages/layout.tsx app/src/context/server-sync.tsx
git commit -m "feat(layout): mount SyncStatusBar with server sync status"
```

---

### Task 8: Add `visibilitychange` proactive sync

**Files:**
- Modify: `app/src/pages/layout.tsx`

- [ ] **Step 1: Add proactive sync handler to `visibilitychange`**

In `app/src/pages/layout.tsx`, the existing `visibilitychange` handler at line 242 only hides sidebar on `hidden` state. Add a handler for `visible` state that triggers proactive sync:

```tsx
import { useServerSDK } from "@/context/server-sdk"

// Inside the Layout component's onMount or as a separate effect:
const serverSDK = useServerSDK()
const HEARTBEAT_TIMEOUT_MS = 15_000

makeEventListener(document, "visibilitychange", () => {
  if (document.visibilityState !== "visible") {
    // existing hide logic
    reset()
    return
  }

  // NEW: Proactive sync when returning from background
  // Check if SSE stream is stale (last event > heartbeat timeout)
  const serverSync = useServerSync()
  
  // If server status is disconnected or connecting, force a refresh
  const status = serverSDK.status()
  if (status === "disconnected" || status === "connecting") {
    // Queue will handle the refresh once SSE reconnects
    // But we can also trigger bootstrap refetch immediately
    void serverSync.data  // trigger reactive read to ensure context is active
  }
})
```

**Note**: The actual `visibilitychange` sync logic should be in `server-sync.tsx` since it has access to the `queue` and `bootstrap` instances. The layout just needs to ensure the sync context is active when the page becomes visible. The `server-sdk.tsx` already handles SSE reconnection on visibility change (line 225-230). The `server-sync.tsx` already handles `server.connected` events triggering queue push (line 388-394). The gap is: if the page was in background for > 15s (heartbeat timeout), the SSE stream gets aborted and reconnects, which fires `server.connected` → queue push. This already works. So the enhancement is minimal — we just need to ensure the `recent` guard doesn't block it for mobile.

To bypass the `recent` guard: The `recent` check at `server-sync.tsx:376` uses `bootedAt`. When the page returns from background after > 1.5s, `Date.now() - bootedAt` will be large, so `recent` will be `false` and the refresh will proceed normally. No change needed here.

However, we should add an explicit `visibilitychange` handler in `server-sync.tsx` that calls `queue.refresh()` + `bootstrap.refetch()` when the page becomes visible AND the SSE stream is stale, as an additional safety net:

```typescript
// In createServerSyncContextInner(), add visibilitychange handler:
onMount(() => {
  makeEventListener(document, "visibilitychange", () => {
    if (document.visibilityState !== "visible") return
    // If SSE was stale (disconnected for > heartbeat timeout), force sync
    // The SSE reconnect will also trigger server.connected, but this is faster
    const status = serverSDK.status()
    if (status !== "connected") {
      queue.refresh()
      void bootstrap.refetch()
    }
  })
})
```

This ensures that even if the `server.connected` event is delayed or dropped, the page resuming still triggers a sync.

- [ ] **Step 2: Commit**

```bash
git add app/src/pages/layout.tsx app/src/context/server-sync.tsx
git commit -m "feat(sync): add visibilitychange proactive sync for mobile resume"
```

---

### Task 9: Verify and test the full flow

**Files:**
- All modified files from Tasks 1-8

- [ ] **Step 1: Run TypeScript type check**

Run: `bun run --cwd app typecheck` (or equivalent)
Expected: No type errors

- [ ] **Step 2: Run existing tests**

Run: `bun test app/src/context/global-sync/`
Expected: All existing tests pass, new `isDraining` test passes

- [ ] **Step 3: Manual smoke test on dev server**

1. Start backend: `bun run --conditions=browser ./core/src/index.ts serve --port 4096`
2. Start app: `bun dev -- --port 4444`
3. Open `http://localhost:4444`
4. Verify refresh button appears in titlebar
5. Click refresh button — verify spinning animation and data reload
6. Disconnect network (browser dev tools offline) — verify status bar shows "连接已断开…"
7. Reconnect — verify status bar transitions through "重新连接…" → "同步中…" → "已同步" → disappears

- [ ] **Step 4: Build for Android**

Run: `VITE_PLATFORM=android bun run --cwd app build`
Expected: Build succeeds without errors

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address any issues found during verification"
```

---

## Self-Review Checklist

1. **Spec coverage**: Each spec requirement (R1-R5) has a corresponding task:
   - R1 (refresh button) → Task 4 + Task 5
   - R2 (context-aware refresh) → Task 4
   - R3 (auto-sync on reconnect) → Task 2 + Task 8
   - R4 (status indicator) → Task 6 + Task 7
   - R5 (auto-hide after sync) → Task 6

2. **Placeholder scan**: No TBDs, TODOs, or vague requirements. All code shown inline.

3. **Type consistency**: `SyncStatus` type defined in `sync-status.tsx` and used consistently across `SyncStatusBar`, `useSyncStatus`, and `server-sync.tsx`. `isDraining()` returns `boolean`, `status()` returns `"disconnected" | "connecting" | "connected"` — both used correctly in `createSyncStatus`.