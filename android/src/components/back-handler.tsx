import { onCleanup, onMount } from "solid-js"
import { usePlatform } from "../../../app/src/context/platform"
import { useNavigate, useLocation } from "@solidjs/router"

/**
 * Handles Android hardware back button.
 * - In a sub-route (session, settings): navigate to parent
 * - On home screen: let system handle (minimize app)
 */
export function BackHandler() {
  const platform = usePlatform()
  const navigate = useNavigate()
  const location = useLocation()

  onMount(() => {
    if (platform.platform !== "android") return
    if (!platform.onBackPressed) return

    const cleanup = platform.onBackPressed(() => {
      const path = location.pathname

      // On home screen — let system handle
      if (path === "/") return false

      // In session — go to home
      if (path.includes("/session")) {
        navigate("/")
        return true
      }

      // In any sub-route — browser back
      window.history.back()
      return true
    })

    onCleanup(cleanup)
  })

  return null
}
