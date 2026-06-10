import { Show, createEffect, createSignal, onCleanup } from "solid-js"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import type { SyncStatus } from "@/context/sync-status"

const STATUS_CONFIG: Record<SyncStatus, { bg: string; text: string; icon: string }> = {
  idle: { bg: "", text: "", icon: "" },
  disconnected: { bg: "bg-[var(--v2-background-bg-layer-02)]", text: "连接已断开", icon: "alert-circle" },
  connecting: { bg: "bg-[var(--v2-background-bg-layer-02)]", text: "重新连接中…", icon: "refresh" },
  syncing: { bg: "bg-[var(--v2-background-bg-layer-02)]", text: "同步中…", icon: "refresh" },
  synced: { bg: "bg-[var(--v2-background-bg-layer-02)]", text: "已同步", icon: "check" },
}

const SYNCED_HIDE_DELAY_MS = 1500

export function SyncStatusBar(props: { status: () => SyncStatus }) {
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
        <span class="text-v2-text-text-base">{config().text}</span>
      </div>
    </Show>
  )
}
