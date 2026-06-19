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

if (window._OC_DIAG) window._OC_DIAG.push("4-js-module-loaded")

createAndroidPlatform()
  .then((platform) => {
    if (window._OC_DIAG) window._OC_DIAG.push("5-platform-created")
    render(
      () => (
        <PlatformProvider value={platform}>
          <AppBaseProviders>
            <AppInterface
              defaultServer={ServerConnection.Key.make("")}
              disableHealthCheck={false}
              mobileShell={<><BackHandler /></>}
            />
          </AppBaseProviders>
        </PlatformProvider>
      ),
      root!,
    )
    if (window._OC_DIAG) window._OC_DIAG.push("6-render-called")
  })
  .catch((err) => {
    if (window._OC_DIAG) window._OC_DIAG.push("5-platform-failed:" + err)
    const r = document.getElementById("root")
    if (r) {
      r.style.background = "#1a0000"
      r.style.color = "#ff6b6b"
      r.innerHTML = "[PLATFORM-ERROR] " + err + "<br>" + (window._OC_DIAG || []).join("<br>")
    }
  })
