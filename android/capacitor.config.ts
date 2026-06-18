import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "ai.opencode.app",
  appName: "OpenCode",
  webDir: "../app/dist",
  server: {
    androidScheme: "http",
  },
  plugins: {
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    StatusBar: {
      backgroundColor: "#00000000",
      overlaysWebView: true,
    },
  },
}

export default config
