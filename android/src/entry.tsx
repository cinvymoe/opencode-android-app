// @refresh reload

import "./styles/mobile.css"
import { render } from "solid-js/web"
import { AppBaseProviders, AppInterface } from "@/app"
import { PlatformProvider } from "@/context/platform"
import { createAndroidPlatform } from "./platform"
import { ServerConnection } from "@/context/server"
import { MobileTabBar } from "./components/mobile-tab-bar"
import { BackHandler } from "./components/back-handler"

document.documentElement.dataset.platform = "android"

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

createAndroidPlatform().then((platform) => {
  render(
    () => (
      <PlatformProvider value={platform}>
        <AppBaseProviders>
          <AppInterface
            defaultServer={ServerConnection.Key.make("")}
            disableHealthCheck={false}
            mobileShell={<><MobileTabBar /><BackHandler /></>}
          />
        </AppBaseProviders>
      </PlatformProvider>
    ),
    root!,
  )
})
