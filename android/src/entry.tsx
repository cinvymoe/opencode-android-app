// @refresh reload

import "./styles/mobile.css"
import { render } from "solid-js/web"
import { AppBaseProviders, AppInterface } from "@/app"
import { PlatformProvider } from "@/context/platform"
import { createAndroidPlatform } from "./platform"
import { ServerConnection } from "@/context/server"
import { BackHandler } from "./components/back-handler"

document.documentElement.dataset.platform = "android"

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

createAndroidPlatform().then((platform) => {
  const server: ServerConnection.Http = {
    type: "http",
    authToken: false,
    http: { url: "http://localhost:4096" },
  }

  render(
    () => (
      <PlatformProvider value={platform}>
        <AppBaseProviders onThemeApplied={(_, mode) => {
          if ("setStatusBarStyle" in platform) platform.setStatusBarStyle!(mode)
        }}>
          <AppInterface
            defaultServer={ServerConnection.Key.make("http://localhost:4096")}
            servers={[server]}
            disableHealthCheck
            mobileShell={<><BackHandler /></>}
          />
        </AppBaseProviders>
      </PlatformProvider>
    ),
    root!,
  )
})
