import { readFileSync } from "node:fs"
import solidPlugin from "vite-plugin-solid"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath } from "url"

const theme = fileURLToPath(new URL("./public/oc-theme-preload.js", import.meta.url))

const channel = (() => {
  const raw = process.env.OPENCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  if (process.env.OPENCODE_CHANNEL === "latest") return "prod"
  return "dev"
})()

const isAndroid = process.env.VITE_PLATFORM === "android"

/**
 * @type {import("vite").PluginOption}
 */
export default [
  {
    name: "opencode-desktop:config",
    config() {
      return {
        resolve: {
          alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
            "@android": fileURLToPath(new URL("../android/src", import.meta.url)),
          },
        },
        define: {
          "import.meta.env.VITE_OPENCODE_CHANNEL": JSON.stringify(channel),
          "import.meta.env.VITE_PLATFORM": JSON.stringify(isAndroid ? "android" : "web"),
        },
        worker: {
          format: "es",
        },
      }
    },
  },
  isAndroid && {
    name: "opencode-android:entry",
    config() {
      return {
        build: {
          rollupOptions: {
            input: fileURLToPath(new URL("../android/src/entry.tsx", import.meta.url)),
          },
        },
      }
    },
    async resolveId(source, importer, options) {
      if (source.startsWith(".") || source.startsWith("/")) return null
      if (!importer || !importer.includes("/android/src/")) return null

      const appProxy = fileURLToPath(new URL("./src/_resolve_proxy.ts", import.meta.url))
      const resolution = await this.resolve(source, appProxy, { skipSelf: true, ...options })
      return resolution
    },
    transformIndexHtml() {
      return undefined
    },
  },
  {
    name: "opencode-desktop:theme-preload",
    transformIndexHtml(html) {
      return html.replace(
        '<script id="oc-theme-preload-script" src="/oc-theme-preload.js"></script>',
        `<script id="oc-theme-preload-script">${readFileSync(theme, "utf8")}</script>`,
      )
    },
  },
  tailwindcss(),
  solidPlugin(),
]
