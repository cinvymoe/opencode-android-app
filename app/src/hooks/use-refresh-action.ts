import { createSignal } from "solid-js"
import { useServerSync } from "@/context/server-sync"
import { useLayout } from "@/context/layout"
import { useLanguage } from "@/context/language"
import { useServerSDK } from "@/context/server-sdk"
import { showToast } from "@/utils/toast"
import { formatServerError } from "@/utils/server-errors"
import { useQueryClient } from "@tanstack/solid-query"

export function useRefreshAction() {
  const [isRefreshing, setIsRefreshing] = createSignal(false)
  const serverSync = useServerSync()
  const layout = useLayout()
  const language = useLanguage()
  const serverSDK = useServerSDK()
  const queryClient = useQueryClient()

  async function refresh() {
    if (isRefreshing()) return
    setIsRefreshing(true)

    try {
      const route = layout.route()

      if (route.type === "home") {
        await queryClient.refetchQueries({ queryKey: [serverSDK.scope, "bootstrap"] })
        return
      }

      if (route.type === "session") {
        const dirSync = serverSync.createDirSyncContext(route.dir)
        await Promise.all([
          dirSync.session.sync(route.sessionId, { force: true }),
          dirSync.session.diff(route.sessionId, { force: true }),
          dirSync.session.todo(route.sessionId, { force: true }),
        ])
        return
      }

      if ("dir" in route && route.dir) {
        await serverSync.project.loadSessions(route.dir as string)
        return
      }
    } catch (error) {
      showToast({
        variant: "error",
        title: language.t("common.requestFailed"),
        description: formatServerError(error, language.t),
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  return { refresh, isRefreshing }
}
