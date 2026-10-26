import { Island } from "../islands/Island";
import notFound1 from "../islands/notFound1.js";

export function NotFound() {
  return (
    <>
  <section id="not-found" className="imbo-404">
    <div className="lp-container flex flex-col items-center">
      {"\n      "}
      <p className="font-['JetBrains_Mono'] text-sm text-lp-fg-muted">404 · returned to sender</p>
      {"\n      "}
      <h1 className="imbo-404__title">No one here.</h1>
      {"\n      "}
      <p className="imbo-404__lead">
        {"There's no page at "}
        <code data-path="">this address</code>
        . It may have moved, or the link has a typo.
      </p>
      {"\n      "}
      <div className="imbo-404__actions">
        <a href="/" className="state-layer focus-ring inline-flex items-center justify-center gap-2 rounded-lp-button font-medium whitespace-nowrap transition-transform duration-(--lp-dur-fast) ease-(--lp-ease) active:scale-[0.97] h-11 px-5 text-base bg-lp-accent text-lp-accent-fg shadow-(--lp-button-shadow)">Back to imbo.dev</a>
        <a href="/#faq" className="state-layer focus-ring inline-flex items-center justify-center gap-2 rounded-lp-button font-medium whitespace-nowrap transition-transform duration-(--lp-dur-fast) ease-(--lp-ease) active:scale-[0.97] h-11 px-5 text-base lp-hair-strong text-lp-fg">Read the FAQ</a>
      </div>
      {"\n    "}
    </div>
  </section>
  <Island run={notFound1} />
    </>
  );
}
