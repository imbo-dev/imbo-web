// The header's "N sessions live" from API-074, fetched on mount and then every 60 s;
// the segment stays hidden while the number can't be had (DESIGN §13).
const API = import.meta.env.VITE_IMBO_API ?? "https://api.imbo.dev";

export default function run(script: HTMLScriptElement) {
  const box = script.closest<HTMLElement>("[data-sessions-live]");
  const text = box?.querySelector<HTMLElement>("[data-sessions-live-text]");
  if (!box || !text) return;
  const load = async () => {
    try {
      const res = await fetch(`${API}/v1/stats`, { signal: AbortSignal.timeout(10_000) });
      const n: unknown = res.ok ? (await res.json()).sessions_live : undefined;
      if (typeof n !== "number" || !Number.isInteger(n)) throw new Error("no count");
      text.textContent = `${n} ${n === 1 ? "session" : "sessions"} live`;
      box.hidden = false;
      box.style.opacity = "1";
    } catch {
      box.hidden = true;
    }
  };
  void load();
  const timer = setInterval(() => (box.isConnected ? void load() : clearInterval(timer)), 60_000);
}
