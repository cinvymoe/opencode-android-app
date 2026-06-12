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
  },
}

export default config
