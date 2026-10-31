import { useSyncExternalStore } from "react"
import { zh } from "./zh"

// The page's words are written in English where they are used; `t` looks them up in `zh` when the page is in Chinese.
// The language is the one picked on the Account page, kept in this browser, or the browser's own (ADR-053). The app
// draws everything again when it changes; values worked out once at import time would keep the old language, so there
// are none.

export type Lang = "en" | "zh"
/** What the Account page offers: a language, or whatever the browser prefers. */
export type Choice = Lang | "system"

const SAVED = "imbo.language"
const browser = (): Lang => ((navigator.languages?.[0] ?? navigator.language ?? "").toLowerCase().startsWith("zh") ? "zh" : "en")

function saved(): Choice {
  try {
    const v = localStorage.getItem(SAVED)
    return v === "en" || v === "zh" ? v : "system"
  } catch {
    return "system"
  }
}

let state = { choice: saved(), lang: "en" as Lang }
const listeners = new Set<() => void>()

/** brand/DESIGN.md: the page's lang picks the font stack and line height for Chinese. */
function apply(choice: Choice) {
  state = { choice, lang: choice === "system" ? browser() : choice }
  document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en"
  listeners.forEach((l) => l())
}
apply(state.choice)
addEventListener("languagechange", () => state.choice === "system" && apply("system"))

export function setLanguage(choice: Choice) {
  try {
    localStorage.setItem(SAVED, choice)
  } catch {
    // A browser that keeps nothing still switches for this visit.
  }
  apply(choice)
}

export const useLanguage = () => useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => state)

export const currentLang = () => state.lang

/** Every English text the page shows; one missing from `zh` is a type error. */
export type Key = keyof typeof zh

/** The text in the page's language, with each `{name}` filled from `vars`. */
export function t(key: Key, vars?: Record<string, string | number>) {
  const s: string = state.lang === "zh" ? zh[key] : key
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s
}
