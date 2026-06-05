import { createSignal, Show } from "solid-js"
import { useServer, normalizeServerUrl, ServerConnection } from "../../../app/src/context/server"
import { usePlatform } from "../../../app/src/context/platform"
import { Button } from "@opencode-ai/ui/button"

export function OnboardingPage() {
  const server = useServer()
  const platform = usePlatform()
  const [url, setUrl] = createSignal("")
  const [username, setUsername] = createSignal("")
  const [password, setPassword] = createSignal("")
  const [error, setError] = createSignal<string | null>(null)
  const [testing, setTesting] = createSignal(false)

  async function handleConnect() {
    const normalized = normalizeServerUrl(url())
    if (!normalized) {
      setError("Please enter a valid server URL")
      return
    }

    setTesting(true)
    setError(null)

    try {
      const headers: Record<string, string> = {}
      if (username() || password()) {
        headers.Authorization = `Basic ${btoa(`${username()}:${password()}`)}`
      }

      const response = await fetch(`${normalized}/health`, {
        headers: Object.keys(headers).length ? headers : undefined,
      })

      if (!response.ok) throw new Error(`Server returned ${response.status}`)

      const conn = server.add({
        type: "http",
        http: {
          url: normalized,
          ...(username() ? { username: username() } : {}),
          ...(password() ? { password: password() } : {}),
        },
      })

      if (conn) {
        await platform.setDefaultServer?.(ServerConnection.key(conn))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect to server")
    } finally {
      setTesting(false)
    }
  }

  return (
    <div class="h-dvh w-screen flex flex-col items-center justify-center bg-background-base p-6">
      <div class="flex flex-col items-center max-w-sm w-full gap-8">
        <div class="flex flex-col items-center gap-3">
          <h1 class="text-2xl font-semibold text-text-strong">OpenCode</h1>
          <p class="text-sm text-text-base text-center">
            Connect to your OpenCode server to get started
          </p>
        </div>

        <div class="flex flex-col gap-4 w-full">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-text-weak">Server URL</label>
            <input
              type="url"
              placeholder="http://192.168.1.100:4096"
              value={url()}
              onInput={(e) => setUrl(e.currentTarget.value)}
              class="w-full px-3 py-2.5 rounded-lg bg-surface-raised-base text-sm text-text-strong border border-border-base focus:border-border-accent focus:outline-none"
            />
          </div>

          <details class="group">
            <summary class="text-xs font-medium text-text-weak cursor-pointer">
              Authentication (optional)
            </summary>
            <div class="flex flex-col gap-3 mt-3">
              <input
                type="text"
                placeholder="Username"
                value={username()}
                onInput={(e) => setUsername(e.currentTarget.value)}
                class="w-full px-3 py-2.5 rounded-lg bg-surface-raised-base text-sm text-text-strong border border-border-base focus:border-border-accent focus:outline-none"
              />
              <input
                type="password"
                placeholder="Password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                class="w-full px-3 py-2.5 rounded-lg bg-surface-raised-base text-sm text-text-strong border border-border-base focus:border-border-accent focus:outline-none"
              />
            </div>
          </details>

          <Show when={error()}>
            <p class="text-xs text-red-500">{error()}</p>
          </Show>

          <Button
            size="lg"
            class="w-full"
            onClick={handleConnect}
            disabled={testing() || !url()}
          >
            {testing() ? "Connecting..." : "Connect"}
          </Button>
        </div>

        <p class="text-xs text-text-weak text-center">
          Run <code class="text-text-base bg-surface-raised-base px-1.5 py-0.5 rounded text-xs">opencode serve</code> on your machine to start a server
        </p>
      </div>
    </div>
  )
}
