import type { Platform } from "@/context/platform"
import { ServerConnection } from "@/context/server"
import { Preferences } from "@capacitor/preferences"
import { Share } from "@capacitor/share"
import { StatusBar, Style } from "@capacitor/status-bar"
import { App } from "@capacitor/app"
import pkg from "../package.json"

const DEFAULT_SERVER_KEY = "opencode.android.defaultServer"

function setupStatusBarObserver(): void {
  StatusBar.setOverlaysWebView({ overlay: true }).catch((e) =>
    console.warn("StatusBar.setOverlaysWebView failed:", e),
  )
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
      await StatusBar.setStyle({ style: style === "dark" ? Style.Light : Style.Dark }).catch((e) =>
        console.warn("StatusBar.setStyle failed:", e),
      )
    },
  }
}
