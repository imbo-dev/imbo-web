import { lazy, Suspense, useEffect, useSyncExternalStore } from "react"
import { Toaster } from "sonner"
import { AuthFlow } from "@/pages/Auth"
import { Inbox, type Tab } from "@/pages/inbox/Shell"
import { Admin, type AdminTab } from "@/pages/admin/Admin"
import { demo, useStore } from "@/data/store"
import { navigate, usePath } from "@/lib/router"

const TABS: Tab[] = ["chats", "sessions", "contacts", "account"]
// Only the mock build has the demo controls.
const panel = demo?.then((m) => ({ default: m.DemoPanel }))
const DemoPanel = panel && lazy(() => panel)

/** Where to go after signing in: the page the sign-in interrupted, if it's one of ours. */
function nextPage() {
  const next = new URLSearchParams(location.search).get("next")
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/chats"
}

// Below the sm breakpoint a dialog rises from the bottom of the screen, so notices go to the top to stay off its buttons.
const wide = matchMedia("(min-width: 40rem)")
const onResize = (f: () => void) => {
  wide.addEventListener("change", f)
  return () => wide.removeEventListener("change", f)
}

const ADMIN_TABS: AdminTab[] = ["users", "dashboard"]

// /login, /register, /welcome (after sign-up), then /chats[/<chat>], /sessions[/<session>], /contacts[/<account ID>],
// /account[/blocks], and for admins /admin[/users|/dashboard] (PAGE-WEB-ADMIN; anyone else sees "not here").
// Signed out on one of those → /login?next=<that page>, and back there after signing in.
function Route() {
  const path = usePath()
  const { account, isNew } = useStore()
  const [, first = "", item] = path.split("/")
  const tab = TABS.find((t) => t === first)
  const admin = first === "admin"
  const adminTab = !item ? "reports" : ADMIN_TABS.find((t) => t === item)
  const auth = first === "login" || first === "register"
  const to =
    account === undefined
      ? null
      : auth
        ? account && (isNew ? "/welcome" : nextPage())
        : !account
          ? (tab || admin) && path !== "/chats"
            ? `/login?next=${encodeURIComponent(path + location.search)}`
            : "/login"
          : first === "welcome" || admin
            ? null
            : !tab || (tab === "account" && item && item !== "blocks")
              ? "/chats"
              : null

  useEffect(() => {
    if (to) navigate(to, { replace: true })
  }, [to])

  // Until /v1/me answers, nothing: the page doesn't know yet whether this browser is signed in.
  if (to || account === undefined) return null
  if (auth || first === "welcome") return <AuthFlow page={first as "login" | "register" | "welcome"} />
  if (admin) return account?.admin && adminTab ? <Admin tab={adminTab} /> : <Inbox tab="chats" missing />
  return <Inbox tab={tab!} item={item ? decodeURIComponent(item) : undefined} />
}

export function App() {
  const isWide = useSyncExternalStore(onResize, () => wide.matches)
  return (
    <>
      <Route />
      {DemoPanel && (
        <Suspense fallback={null}>
          <DemoPanel />
        </Suspense>
      )}
      <Toaster
        position={isWide ? "bottom-center" : "top-center"}
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
