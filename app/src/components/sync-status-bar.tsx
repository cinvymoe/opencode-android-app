import { Show, createEffect, createSignal, onCleanup } from "solid-js"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import type { SyncStatus } from "@/context/sync-status"
import type { useLanguage } from "@/context/language"

const STATUS_CONFIG: Record<SyncStatus, { bg: string; icon: string }> = {
  idle: { bg: "", icon: "" },
  disconnected: { bg: "bg-[var(--v2-background-bg-layer-02)]", icon: "alert-circle" },
  connecting: { bg: "bg-[var(--v2-background-bg-layer-02)]", icon: "refresh" },
  syncing: { bg: "bg-[var(--v2-background-bg-layer-02)]", icon: "refresh" },
  synced: { bg: "bg-[var(--v2-background-bg-layer-02)]", icon: "check" },
}

const SYNC_STATUS_KEYS: Record<SyncStatus, string> = {
  idle: "",
  disconnected: "sync.status.disconnected",
  connecting: "sync.status.connecting",
  syncing: "sync.status.syncing",
  synced: "sync.status.synced",
}

const SYNCED_HIDE_DELAY_MS = 1500

export function SyncStatusBar(props: {
  status: () => SyncStatus
  language: ReturnType<typeof useLanguage>
}) {
  const [visible, setVisible] = createSignal(false)
  let hideTimer: ReturnType<typeof setTimeout> | undefined

  createEffect(() => {
    const s = props.status()
    if (s === "idle") {
      setVisible(false)
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = undefined }
      return
    }

    setVisible(true)

    if (s === "synced") {
      if (hideTimer) clearTimeout(hideTimer)
      hideTimer = setTimeout(() => setVisible(false), SYNCED_HIDE_DELAY_MS)
    } else {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = undefined }
    }
  })

  onCleanup(() => {
    if (hideTimer) clearTimeout(hideTimer)
  })

  const config = () => STATUS_CONFIG[props.status()]
  const isSpinning = () => props.status() === "connecting" || props.status() === "syncing"
  const textKey = () => SYNC_STATUS_KEYS[props.status()]

  return (
    <Show when={visible() && config().bg}>
      <div
        class={`flex h-7 items-center justify-center gap-1.5 text-[13px] [font-weight:440] transition-all duration-200 ${config().bg}`}
        role="status"
        aria-live="polite"
      >
        <span class={`flex size-3.5 items-center justify-center ${isSpinning() ? "animate-spin" : ""}`}>
          <IconV2 name={config().icon} />
        </span>
        <span class="text-v2-text-text-base">{props.language.t(textKey() as any)}</span>
      </div>
    </Show>
  )
}
