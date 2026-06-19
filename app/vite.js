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
    async resolveId(source, importer, options) {
      if (source.startsWith(".") || source.startsWith("/")) return null
      if (!importer || !importer.includes("/android/src/")) return null

      const appProxy = fileURLToPath(new URL("./src/_resolve_proxy.ts", import.meta.url))
      const resolution = await this.resolve(source, appProxy, { skipSelf: true, ...options })
      return resolution
    },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html.replace(
          'src="/src/entry.tsx"',
          'src="/src/_android_entry.tsx"',
        )
      },
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
  isAndroid && {
    name: "opencode-android:no-crossorigin",
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        // Vite adds `crossorigin` to <script type="module"> and <link rel="stylesheet"> tags.
        // Capacitor's WebViewLocalServer intercepts requests via shouldInterceptRequest but
        // does NOT set CORS headers. The `crossorigin` attribute causes the WebView to
        // enforce CORS checks, which silently blocks module scripts from loading — resulting
        // in a white screen on Android devices.
        let result = html
          .replace(/(<script\s[^>]*?)crossorigin\s*/g, "$1")
          .replace(/(<link\s[^>]*?)crossorigin\s*/g, "$1")
        // `100dvh` requires Chrome 108+. Older Android WebViews don't support it,
        // causing the root div to have no height. Add a CSS fallback.
        result = result.replace(
          '<div id="root" class="flex flex-col h-dvh p-px">',
          '<div id="root" class="flex flex-col h-screen p-px">',
        )
        return result
      },
    },
  },
  isAndroid && {
    name: "opencode-android:diag",
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const diag = `<script>(function(){var D=window._OC_DIAG=[];function L(m){D.push(m);try{console.log("[OC-DIAG] "+m)}catch(e){}}L("1-html-parse");document.addEventListener("DOMContentLoaded",function(){L("2-dom-ready");var r=document.getElementById("root");L("3-root-"+(r?"found":"MISSING"));if(r){r.innerHTML="[OC-DIAG] App loading...<br>"+D.join("<br>")}});window.onerror=function(m,s,l){L("ERR:"+m+" @"+s+":"+l);var r=document.getElementById("root");if(r){r.style.background="#1a0000";r.style.color="#ff6b6b";r.innerHTML="[JS-ERROR]<br>"+D.join("<br>")}};window.addEventListener("unhandledrejection",function(e){L("REJ:"+e.reason);var r=document.getElementById("root");if(r){r.style.background="#1a0000";r.style.color="#ff6b6b";r.innerHTML="[REJECT]<br>"+D.join("<br>")}})})()</script>`
        return html.replace("<head>", "<head>" + diag)
      },
    },
  },
  tailwindcss(),
  solidPlugin(),
]
