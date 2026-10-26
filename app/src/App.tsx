import { useEffect } from "react"
import { Toaster } from "sonner"
import { DemoPanel } from "@/components/DemoPanel"
import { AuthFlow } from "@/pages/Auth"
import { Inbox, type Tab } from "@/pages/inbox/Shell"
import { useStore } from "@/data/store"
import { navigate, usePath } from "@/lib/router"

const TABS: Tab[] = ["chats", "sessions", "contacts", "account"]

// /login, /register, /welcome (after sign-up), then /chats[/<chat>], /sessions[/<session>], /contacts[/<account ID>], /account.
function Route() {
  const path = usePath()
  const { account } = useStore()
  const [, first = "", item] = path.split("/")
  const tab = TABS.find((t) => t === first)
  const auth = first === "login" || first === "register"
  const to = auth ? (account ? "/chats" : null) : !account ? "/login" : first === "welcome" ? null : !tab || (tab === "account" && item) ? "/chats" : null

  useEffect(() => {
    if (to) navigate(to, { replace: true })
  }, [to])

  if (to) return null
  if (auth || first === "welcome") return <AuthFlow page={first as "login" | "register" | "welcome"} />
  return <Inbox tab={tab!} item={item ? decodeURIComponent(item) : undefined} />
}

export function App() {
  return (
    <>
      <Route />
      <DemoPanel />
      <Toaster
        position="bottom-center"
        toastOptions={{
          unstyled: true,
          classNames: {
            toast: "flex w-(--width) items-center gap-2 font-(family-name:--semantic-typography-body-font-family) rounded-lg border-(length:--semantic-layout-hairline) border-border bg-popover px-4 py-3 text-body text-popover-foreground shadow-overlay",
          },
        }}
      />
    </>
  )
}
