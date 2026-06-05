import { createMemo, For } from "solid-js"
import { useLocation, useNavigate } from "@solidjs/router"

type Tab = {
  label: string
  icon: string
  pathPattern: RegExp
  navigateTo: string
}

const TABS: Tab[] = [
  { label: "Chat", icon: "💬", pathPattern: /^\/$|\/session/, navigateTo: "/" },
  { label: "Files", icon: "📁", pathPattern: /\/file/, navigateTo: "/" },
  { label: "Terminal", icon: "⌨️", pathPattern: /\/terminal/, navigateTo: "/" },
  { label: "Settings", icon: "⚙️", pathPattern: /\/settings/, navigateTo: "/" },
]

export function MobileTabBar() {
  const location = useLocation()
  const navigate = useNavigate()

  const activeIndex = createMemo(() => {
    const path = location.pathname
    const idx = TABS.findIndex((tab) => tab.pathPattern.test(path))
    return idx === -1 ? 0 : idx
  })

  return (
    <nav
      data-component="mobile-tab-bar"
      class="hidden fixed bottom-0 left-0 right-0 flex items-center justify-around bg-surface-base border-t border-border-base z-50"
      style={{ "padding-bottom": "var(--sab, 0px)", height: "calc(56px + var(--sab, 0px))" }}
    >
      <For each={TABS}>
        {(tab, i) => {
          const isActive = createMemo(() => activeIndex() === i())
          return (
            <button
              type="button"
              class="flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors"
              classList={{
                "text-text-accent": isActive(),
                "text-text-weak": !isActive(),
              }}
              onClick={() => navigate(tab.navigateTo)}
            >
              <span class="text-lg leading-none">{tab.icon}</span>
              <span class="text-[10px] font-medium leading-none">{tab.label}</span>
            </button>
          )
        }}
      </For>
    </nav>
  )
}
