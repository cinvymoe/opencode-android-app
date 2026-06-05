// @refresh reload

import { render } from "solid-js/web"
import { AppBaseProviders, AppInterface } from "../../app/src/app"
import { PlatformProvider } from "../../app/src/context/platform"
import { createAndroidPlatform } from "./platform"
import { ServerConnection } from "../../app/src/context/server"
import { MobileTabBar } from "./components/mobile-tab-bar"
import { BackHandler } from "./components/back-handler"

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
