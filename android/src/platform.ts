import type { Platform } from "@/context/platform"
import { ServerConnection } from "@/context/server"
import { Preferences } from "@capacitor/preferences"
import { Share } from "@capacitor/share"
import { StatusBar, Style } from "@capacitor/status-bar"
import { App } from "@capacitor/app"
import pkg from "../package.json"

const DEFAULT_SERVER_KEY = "opencode.android.defaultServer"

function applySafeAreaInsets(): void {
  StatusBar.getInfo()
    .then((info) => {
      const height = info.height ?? 0
      document.documentElement.style.setProperty("--sat", `${height}px`)
    })
    .catch((e) => {
      console.warn("StatusBar.getInfo failed:", e)
      document.documentElement.style.setProperty("--sat", "env(safe-area-inset-top, 24px)")
    })
}

function setupStatusBarObserver(): void {
  // Enable edge-to-edge by making status bar overlay the webview
  StatusBar.setOverlaysWebView({ overlay: true })
    .then(() => applySafeAreaInsets())
    .catch((e) => console.warn("StatusBar.setOverlaysWebView failed:", e))

  const update = () => {
    const el = document.documentElement
    if (!el) return

    const colorScheme = el.dataset.colorScheme
    // Dark mode → light text, light mode → dark text
    const style = colorScheme === "dark" ? Style.Light : Style.Dark
    StatusBar.setStyle({ style }).catch((e) =>
      console.warn("StatusBar.setStyle failed:", e),
    )
  }

  update()

  const observer = new MutationObserver(update)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-color-scheme"],
  })
  // Observer lives for app lifetime — no cleanup needed
}

export async function createAndroidPlatform(): Promise<Platform> {
  setupStatusBarObserver()

  return {
    platform: "android",
    version: pkg.version,

    openLink(url: string) {
      window.open(url, "_blank", "noopener,noreferrer")
    },

    back() {
      window.history.back()
    },

    forward() {
      window.history.forward()
    },

    async restart() {
      window.location.reload()
    },

    async notify(title: string, description?: string) {
      if (!("Notification" in window)) return
      const permission = await Notification.requestPermission()
      if (permission !== "granted") return
      new Notification(title, { body: description })
    },

    async getDefaultServer() {
      const { value } = await Preferences.get({ key: DEFAULT_SERVER_KEY })
      return value ? ServerConnection.Key.make(value) : null
    },

    async setDefaultServer(url: ServerConnection.Key | null) {
      if (url === null) {
        await Preferences.remove({ key: DEFAULT_SERVER_KEY })
        return
      }
      await Preferences.set({ key: DEFAULT_SERVER_KEY, value: url })
    },

    async share(opts) {
      await Share.share(opts)
    },

    onBackPressed(callback: () => boolean) {
      const handler = App.addListener("backButton", () => {
        if (!callback()) App.exitApp()
      })
      return () => {
        handler.then((h) => h.remove())
      }
    },

    getSafeAreaInsets() {
      const style = getComputedStyle(document.documentElement)
      const parse = (prop: string) => parseInt(style.getPropertyValue(prop)) || 0
      return {
        top: parse("--sat"),
        bottom: parse("--sab"),
        left: parse("--sal"),
        right: parse("--sar"),
      }
    },

    async setStatusBarStyle(style: "dark" | "light") {
      await StatusBar.setStyle({ style: style === "dark" ? Style.Light : Style.Dark })
    },
  }
}
