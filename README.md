# OpenCode Android App

An Android client for [OpenCode](https://opencode.ai). Connect to your opencode server from your phone.

> **Note:** This project is not built by the OpenCode team and is not affiliated with the official OpenCode project.

## Features

- Connect to your opencode server with a custom address and optional authentication
- Browse projects and jump into new or existing coding sessions
- Chat with the AI coding agent through a mobile-optimized interface
- Review permission requests, todos, diffs, and session context
- Adjust model, language, theme mode, and notification preferences

## Prerequisites

- [Bun](https://bun.sh) runtime
- Android SDK (compileSdk 34, minSdk 22)
- JDK 17
- Android Studio (for development)

## Getting Started

1. Install dependencies:

```bash
bun install
```

2. Build the web app for Android:

```bash
VITE_PLATFORM=android bun run --cwd app build
```

3. Sync to Android native project:

```bash
cd android && npx cap sync android
```

4. Open in Android Studio:

```bash
cd android && npx cap open android
```

## Development

```bash
# Start dev server
bun run dev

# Build for Android
bun run build:android
```

## Usage

1. Start your opencode server:

```bash
opencode serve
```

2. The server runs at `http://127.0.0.1:4096` by default.

3. Open the app on your Android device, enter the server address, and connect.

## Building Release APK

```bash
cd android/android && ./gradlew assembleRelease
```

The signed APK will be at `android/android/app/build/outputs/apk/release/`.

## License

MIT
