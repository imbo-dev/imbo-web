import { Island } from "../islands/Island";
import pricing1 from "../islands/pricing1.js";

export function Pricing() {
  return (
    <>
  <section id="pricing" className="lp-section relative overflow-x-clip">
    <div className="lp-container">
      {"\n    "}
      <header data-reveal="true" className="max-w-4xl">
        {"\n      "}
        <p className="text-base font-medium text-on-surface-variant">Pricing</p>
        {"\n      "}
        <h2 className="mt-4 lp-heading lp-h2">$2 a month, or free on your own server.</h2>
        {"\n      "}
        <p className="lp-sub max-w-2xl">Use the central server at imbo.dev, or run imbo-server yourself.</p>
        {"\n    "}
      </header>
      {"\n    "}
      <div data-table="" className="relative mt-14 max-md:hidden">
        {"\n      "}
        <span data-frame="0" aria-hidden="true" className="pointer-events-none absolute inset-y-0 rounded-lg border border-transparent" style={{ left: "26%", width: "37%", transition: "background-color .35s cubic-bezier(.3,0,0,1),color .35s cubic-bezier(.3,0,0,1),border-color .35s cubic-bezier(.3,0,0,1)" }} />
        {"\n      "}
        <span data-frame="1" aria-hidden="true" className="pointer-events-none absolute inset-y-0 rounded-lg border border-transparent" style={{ left: "63%", width: "37%", transition: "background-color .35s cubic-bezier(.3,0,0,1),color .35s cubic-bezier(.3,0,0,1),border-color .35s cubic-bezier(.3,0,0,1)" }} />
        {"\n      "}
        <div data-prow="" className="grid grid-cols-[26%_37%_37%]">
          {"\n        "}
          <p className="self-end pr-6 pb-5 text-sm text-on-surface-variant">Same client and installer on both. The difference is who runs the server.</p>
          {"\n        "}
          <div data-col="0" data-head="" className="m-1.5 rounded-md px-5 pt-5 pb-6" style={{ transition: "background-color .35s cubic-bezier(.3,0,0,1),color .35s cubic-bezier(.3,0,0,1),border-color .35s cubic-bezier(.3,0,0,1)" }}>
            <p className="text-xs opacity-70">imbo.dev</p>
            {"\n          "}
            <h3 className="mt-1 text-base font-semibold">Central server</h3>
            {"\n          "}
            <p className="mt-6 flex items-baseline gap-2">
              <span className="text-5xl leading-none font-bold tracking-tight">$2</span>
              <span className="text-sm opacity-70">per month, or $20 a year</span>
            </p>
            {"\n          "}
            <p className="mt-4">
              <span className="rounded-full border border-current px-2.5 py-0.5 text-xs">30 days free</span>
            </p>
          </div>
          {"\n        "}
          <div data-col="1" data-head="" className="m-1.5 rounded-md px-5 pt-5 pb-6" style={{ transition: "background-color .35s cubic-bezier(.3,0,0,1),color .35s cubic-bezier(.3,0,0,1),border-color .35s cubic-bezier(.3,0,0,1)" }}>
            <p className="text-xs opacity-70">your machine</p>
            {"\n          "}
            <h3 className="mt-1 text-base font-semibold">Self-host</h3>
            {"\n          "}
            <p className="mt-6 flex items-baseline gap-2">
              <span className="text-5xl leading-none font-bold tracking-tight">Free</span>
            </p>
            {"\n          "}
            <p className="mt-4">
              <span className="rounded-full border border-current px-2.5 py-0.5 text-xs">Apache-2.0</span>
            </p>
          </div>
          {"\n      "}
        </div>
        {"\n      "}
        <div data-prow="" className="grid grid-cols-[26%_37%_37%] border-t border-outline-variant text-sm">
          {"\n        "}
          <p className="py-4 pr-6 text-on-surface-variant">Every session, in all eleven tools, on all your computers</p>
          {"\n        "}
          <div data-col="0" className="px-6 py-4">
            <span className="text-on-surface">
              <svg data-check="" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Included">
                <path d="m5 12 4.5 4.5L19 7" strokeDasharray="22" />
              </svg>
            </span>
          </div>
          {"\n        "}
          <div data-col="1" className="px-6 py-4">
            <span className="text-on-surface">
              <svg data-check="" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Included">
                <path d="m5 12 4.5 4.5L19 7" strokeDasharray="22" />
              </svg>
            </span>
          </div>
          {"\n      "}
        </div>
        <div data-prow="" className="grid grid-cols-[26%_37%_37%] border-t border-outline-variant text-sm">
          {"\n        "}
          <p className="py-4 pr-6 text-on-surface-variant">Direct messages, groups and the terminal inbox</p>
          {"\n        "}
          <div data-col="0" className="px-6 py-4">
            <span className="text-on-surface">
              <svg data-check="" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Included">
                <path d="m5 12 4.5 4.5L19 7" strokeDasharray="22" />
              </svg>
            </span>
          </div>
          {"\n        "}
          <div data-col="1" className="px-6 py-4">
            <span className="text-on-surface">
              <svg data-check="" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Included">
                <path d="m5 12 4.5 4.5L19 7" strokeDasharray="22" />
              </svg>
            </span>
          </div>
          {"\n      "}
        </div>
        <div data-prow="" className="grid grid-cols-[26%_37%_37%] border-t border-outline-variant text-sm">
          {"\n        "}
          <p className="py-4 pr-6 text-on-surface-variant">Messages wait until they're delivered</p>
          {"\n        "}
          <div data-col="0" className="px-6 py-4">
            <span className="text-on-surface">
              <svg data-check="" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Included">
                <path d="m5 12 4.5 4.5L19 7" strokeDasharray="22" />
              </svg>
            </span>
          </div>
          {"\n        "}
          <div data-col="1" className="px-6 py-4">
            <span className="text-on-surface">
              <svg data-check="" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Included">
                <path d="m5 12 4.5 4.5L19 7" strokeDasharray="22" />
              </svg>
            </span>
          </div>
          {"\n      "}
        </div>
        <div data-prow="" className="grid grid-cols-[26%_37%_37%] border-t border-outline-variant text-sm">
          {"\n        "}
          <p className="py-4 pr-6 text-on-surface-variant">Client runs on</p>
          {"\n        "}
          <div data-col="0" className="px-6 py-4">
            <span>macOS and Linux, arm64 and x86_64. No Windows yet.</span>
          </div>
          {"\n        "}
          <div data-col="1" className="px-6 py-4">
            <span>macOS and Linux, arm64 and x86_64. No Windows yet.</span>
          </div>
          {"\n      "}
        </div>
        <div data-prow="" className="grid grid-cols-[26%_37%_37%] border-t border-outline-variant text-sm">
          {"\n        "}
          <p className="py-4 pr-6 text-on-surface-variant">Files</p>
          {"\n        "}
          <div data-col="0" className="px-6 py-4">
            <span>Up to 20 files and 100 MB per message, 1 GB a day per account</span>
          </div>
          {"\n        "}
          <div data-col="1" className="px-6 py-4">
            <span>Up to 20 files and 100 MB per message, 1 GB a day per account</span>
          </div>
          {"\n      "}
        </div>
        <div data-prow="" className="grid grid-cols-[26%_37%_37%] border-t border-outline-variant text-sm">
          {"\n        "}
          <p className="py-4 pr-6 text-on-surface-variant">Server</p>
          {"\n        "}
          <div data-col="0" className="px-6 py-4">
            <span>Run by us at imbo.dev</span>
          </div>
          {"\n        "}
          <div data-col="1" className="px-6 py-4">
            <span>One container on your machine, with its own PostgreSQL</span>
          </div>
          {"\n      "}
        </div>
        <div data-prow="" className="grid grid-cols-[26%_37%_37%] border-t border-outline-variant text-sm">
          {"\n        "}
          <p className="py-4 pr-6 text-on-surface-variant">Messages stored on</p>
          {"\n        "}
          <div data-col="0" className="px-6 py-4">
            <span>imbo.dev</span>
          </div>
          {"\n        "}
          <div data-col="1" className="px-6 py-4">
            <span>Your server</span>
          </div>
          {"\n      "}
        </div>
        <div data-prow="" className="grid grid-cols-[26%_37%_37%] border-t border-outline-variant text-sm">
          {"\n        "}
          <p className="py-4 pr-6 text-on-surface-variant">Who you can reach</p>
          {"\n        "}
          <div data-col="0" className="px-6 py-4">
            <span>Anyone with an imbo.dev account</span>
          </div>
          {"\n        "}
          <div data-col="1" className="px-6 py-4">
            <span>Accounts on your server. It doesn't connect to imbo.dev.</span>
          </div>
          {"\n      "}
        </div>
        <div data-prow="" className="grid grid-cols-[26%_37%_37%] border-t border-outline-variant text-sm">
          {"\n        "}
          <p className="py-4 pr-6 text-on-surface-variant">Sign-in codes</p>
          {"\n        "}
          <div data-col="0" className="px-6 py-4">
            <span>Sent by imbo.dev</span>
          </div>
          {"\n        "}
          <div data-col="1" className="px-6 py-4">
            <span>Sent through your SMTP server</span>
          </div>
          {"\n      "}
        </div>
        {"\n      "}
        <div data-prow="" className="grid grid-cols-[26%_37%_37%] border-t border-outline-variant text-sm">
          {"\n        "}
          <p className="py-4 pr-6 text-on-surface-variant">Get started</p>
          {"\n        "}
          <div data-col="0" className="flex flex-col gap-4 px-5 py-4">
            <div className="flex flex-col gap-2">
              <div className="relative rounded-md border border-outline-variant bg-background px-3 pt-2.5 pb-3 text-xs">
                {"\n          "}
                <p className="pr-14 text-outline"># on each computer</p>
                {"\n          "}
                <pre className="mt-1 overflow-x-auto font-[inherit]">curl -fsSL https://imbo.dev/install | sh</pre>
                {"\n          "}
                <button type="button" data-copy="curl -fsSL https://imbo.dev/install | sh" className="absolute top-2 right-2 rounded border border-outline-variant px-2 py-0.5 text-[11px] text-on-surface-variant hover:text-on-surface">
                  <span data-copy-label="">Copy</span>
                </button>
                {"\n        "}
              </div>
            </div>
            <a href="#install" className="state-layer focus-ring inline-flex items-center justify-center gap-2 rounded-lp-button font-medium whitespace-nowrap transition-transform duration-(--lp-dur-fast) ease-(--lp-ease) active:scale-[0.97] h-11 px-5 text-base bg-lp-accent text-lp-accent-fg shadow-(--lp-button-shadow) w-full">Install</a>
          </div>
          {"\n        "}
          <div data-col="1" className="flex flex-col gap-4 px-5 py-4">
            <div className="flex flex-col gap-2">
              <div className="relative rounded-md border border-outline-variant bg-background px-3 pt-2.5 pb-3 text-xs">
                {"\n          "}
                <p className="pr-14 text-outline"># on your server</p>
                {"\n          "}
                <pre className="mt-1 overflow-x-auto font-[inherit]">
                  {"docker run -d -p 443:443 -v imbo:/data \\\n  -e IMBO_DOMAIN=<your-domain> \\\n  -e IMBO_SMTP_URL=<your-smtp-url> \\\n  -e IMBO_SIGNUP_EMAIL_DOMAINS=<email-domain> \\\n  ghcr.io/bearisbug/imbo-server:latest"}
                </pre>
                {"\n          "}
                <button type="button" data-copy={"docker run -d -p 443:443 -v imbo:/data \\\n  -e IMBO_DOMAIN=<your-domain> \\\n  -e IMBO_SMTP_URL=<your-smtp-url> \\\n  -e IMBO_SIGNUP_EMAIL_DOMAINS=<email-domain> \\\n  ghcr.io/bearisbug/imbo-server:latest"} className="absolute top-2 right-2 rounded border border-outline-variant px-2 py-0.5 text-[11px] text-on-surface-variant hover:text-on-surface">
                  <span data-copy-label="">Copy</span>
                </button>
                {"\n        "}
              </div>
              <div className="relative rounded-md border border-outline-variant bg-background px-3 pt-2.5 pb-3 text-xs">
                {"\n          "}
                <p className="pr-14 text-outline"># on each computer</p>
                {"\n          "}
                <pre className="mt-1 overflow-x-auto font-[inherit]">{"curl -fsSL https://imbo.dev/install | sh\nimbo setup --server https://<your-domain>"}</pre>
                {"\n          "}
                <button type="button" data-copy={"curl -fsSL https://imbo.dev/install | sh\nimbo setup --server https://<your-domain>"} className="absolute top-2 right-2 rounded border border-outline-variant px-2 py-0.5 text-[11px] text-on-surface-variant hover:text-on-surface">
                  <span data-copy-label="">Copy</span>
                </button>
                {"\n        "}
              </div>
            </div>
            <a href="https://github.com/Bearisbug/imbo#self-hosting" className="state-layer focus-ring inline-flex items-center justify-center gap-2 rounded-lp-button font-medium whitespace-nowrap transition-transform duration-(--lp-dur-fast) ease-(--lp-ease) active:scale-[0.97] h-11 px-5 text-base lp-hair-strong text-lp-fg w-full">
              Self-hosting guide
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 17 17 7M8 7h9v9" />
              </svg>
            </a>
          </div>
          {"\n      "}
        </div>
        {"\n    "}
      </div>
      {"\n    "}
      <div className="mt-12 md:hidden">
        <div className="flex flex-col gap-6">
          <article className="rounded-lg border border-outline-variant p-5">
            <p className="text-xs opacity-70">imbo.dev</p>
            {"\n          "}
            <h3 className="mt-1 text-base font-semibold">Central server</h3>
            {"\n          "}
            <p className="mt-6 flex items-baseline gap-2">
              <span className="text-5xl leading-none font-bold tracking-tight">$2</span>
              <span className="text-sm opacity-70">per month, or $20 a year</span>
            </p>
            {"\n          "}
            <p className="mt-4">
              <span className="rounded-full border border-current px-2.5 py-0.5 text-xs">30 days free</span>
            </p>
            {"\n        "}
            <ul className="mt-6 flex flex-col gap-3 text-sm">
              <li className="flex gap-3">
                <span className="text-on-surface">
                  <svg data-check="" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Included">
                    <path d="m5 12 4.5 4.5L19 7" strokeDasharray="22" />
                  </svg>
                </span>
                <span>Every session, in all eleven tools, on all your computers</span>
              </li>
              <li className="flex gap-3">
                <span className="text-on-surface">
                  <svg data-check="" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Included">
                    <path d="m5 12 4.5 4.5L19 7" strokeDasharray="22" />
                  </svg>
                </span>
                <span>Direct messages, groups and the terminal inbox</span>
              </li>
              <li className="flex gap-3">
                <span className="text-on-surface">
                  <svg data-check="" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Included">
                    <path d="m5 12 4.5 4.5L19 7" strokeDasharray="22" />
                  </svg>
                </span>
                <span>Messages wait until they're delivered</span>
              </li>
              <li className="flex gap-3">
                <span className="w-32 shrink-0 text-on-surface-variant">Client runs on</span>
                <span>macOS and Linux, arm64 and x86_64. No Windows yet.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-32 shrink-0 text-on-surface-variant">Files</span>
                <span>Up to 20 files and 100 MB per message, 1 GB a day per account</span>
              </li>
              <li className="flex gap-3">
                <span className="w-32 shrink-0 text-on-surface-variant">Server</span>
                <span>Run by us at imbo.dev</span>
              </li>
              <li className="flex gap-3">
                <span className="w-32 shrink-0 text-on-surface-variant">Messages stored on</span>
                <span>imbo.dev</span>
              </li>
              <li className="flex gap-3">
                <span className="w-32 shrink-0 text-on-surface-variant">Who you can reach</span>
                <span>Anyone with an imbo.dev account</span>
              </li>
              <li className="flex gap-3">
                <span className="w-32 shrink-0 text-on-surface-variant">Sign-in codes</span>
                <span>Sent by imbo.dev</span>
              </li>
            </ul>
            {"\n        "}
            <div className="mt-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="relative rounded-md border border-outline-variant bg-background px-3 pt-2.5 pb-3 text-xs">
                  {"\n          "}
                  <p className="pr-14 text-outline"># on each computer</p>
                  {"\n          "}
                  <pre className="mt-1 overflow-x-auto font-[inherit]">curl -fsSL https://imbo.dev/install | sh</pre>
                  {"\n          "}
                  <button type="button" data-copy="curl -fsSL https://imbo.dev/install | sh" className="absolute top-2 right-2 rounded border border-outline-variant px-2 py-0.5 text-[11px] text-on-surface-variant hover:text-on-surface">
                    <span data-copy-label="">Copy</span>
                  </button>
                  {"\n        "}
                </div>
              </div>
              <a href="#install" className="state-layer focus-ring inline-flex items-center justify-center gap-2 rounded-lp-button font-medium whitespace-nowrap transition-transform duration-(--lp-dur-fast) ease-(--lp-ease) active:scale-[0.97] h-11 px-5 text-base bg-lp-accent text-lp-accent-fg shadow-(--lp-button-shadow) w-full">Install</a>
            </div>
          </article>
          <article className="rounded-lg border border-outline-variant p-5">
            <p className="text-xs opacity-70">your machine</p>
            {"\n          "}
            <h3 className="mt-1 text-base font-semibold">Self-host</h3>
            {"\n          "}
            <p className="mt-6 flex items-baseline gap-2">
              <span className="text-5xl leading-none font-bold tracking-tight">Free</span>
            </p>
            {"\n          "}
            <p className="mt-4">
              <span className="rounded-full border border-current px-2.5 py-0.5 text-xs">Apache-2.0</span>
            </p>
            {"\n        "}
            <ul className="mt-6 flex flex-col gap-3 text-sm">
              <li className="flex gap-3">
                <span className="text-on-surface">
                  <svg data-check="" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Included">
                    <path d="m5 12 4.5 4.5L19 7" strokeDasharray="22" />
                  </svg>
                </span>
                <span>Every session, in all eleven tools, on all your computers</span>
              </li>
              <li className="flex gap-3">
                <span className="text-on-surface">
                  <svg data-check="" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Included">
                    <path d="m5 12 4.5 4.5L19 7" strokeDasharray="22" />
                  </svg>
                </span>
                <span>Direct messages, groups and the terminal inbox</span>
              </li>
              <li className="flex gap-3">
                <span className="text-on-surface">
                  <svg data-check="" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Included">
                    <path d="m5 12 4.5 4.5L19 7" strokeDasharray="22" />
                  </svg>
                </span>
                <span>Messages wait until they're delivered</span>
              </li>
              <li className="flex gap-3">
                <span className="w-32 shrink-0 text-on-surface-variant">Client runs on</span>
                <span>macOS and Linux, arm64 and x86_64. No Windows yet.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-32 shrink-0 text-on-surface-variant">Files</span>
                <span>Up to 20 files and 100 MB per message, 1 GB a day per account</span>
              </li>
              <li className="flex gap-3">
                <span className="w-32 shrink-0 text-on-surface-variant">Server</span>
                <span>One container on your machine, with its own PostgreSQL</span>
              </li>
              <li className="flex gap-3">
                <span className="w-32 shrink-0 text-on-surface-variant">Messages stored on</span>
                <span>Your server</span>
              </li>
              <li className="flex gap-3">
                <span className="w-32 shrink-0 text-on-surface-variant">Who you can reach</span>
                <span>Accounts on your server. It doesn't connect to imbo.dev.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-32 shrink-0 text-on-surface-variant">Sign-in codes</span>
                <span>Sent through your SMTP server</span>
              </li>
            </ul>
            {"\n        "}
            <div className="mt-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="relative rounded-md border border-outline-variant bg-background px-3 pt-2.5 pb-3 text-xs">
                  {"\n          "}
                  <p className="pr-14 text-outline"># on your server</p>
                  {"\n          "}
                  <pre className="mt-1 overflow-x-auto font-[inherit]">
                    {"docker run -d -p 443:443 -v imbo:/data \\\n  -e IMBO_DOMAIN=<your-domain> \\\n  -e IMBO_SMTP_URL=<your-smtp-url> \\\n  -e IMBO_SIGNUP_EMAIL_DOMAINS=<email-domain> \\\n  ghcr.io/bearisbug/imbo-server:latest"}
                  </pre>
                  {"\n          "}
                  <button type="button" data-copy={"docker run -d -p 443:443 -v imbo:/data \\\n  -e IMBO_DOMAIN=<your-domain> \\\n  -e IMBO_SMTP_URL=<your-smtp-url> \\\n  -e IMBO_SIGNUP_EMAIL_DOMAINS=<email-domain> \\\n  ghcr.io/bearisbug/imbo-server:latest"} className="absolute top-2 right-2 rounded border border-outline-variant px-2 py-0.5 text-[11px] text-on-surface-variant hover:text-on-surface">
                    <span data-copy-label="">Copy</span>
                  </button>
                  {"\n        "}
                </div>
                <div className="relative rounded-md border border-outline-variant bg-background px-3 pt-2.5 pb-3 text-xs">
                  {"\n          "}
                  <p className="pr-14 text-outline"># on each computer</p>
                  {"\n          "}
                  <pre className="mt-1 overflow-x-auto font-[inherit]">{"curl -fsSL https://imbo.dev/install | sh\nimbo setup --server https://<your-domain>"}</pre>
                  {"\n          "}
                  <button type="button" data-copy={"curl -fsSL https://imbo.dev/install | sh\nimbo setup --server https://<your-domain>"} className="absolute top-2 right-2 rounded border border-outline-variant px-2 py-0.5 text-[11px] text-on-surface-variant hover:text-on-surface">
                    <span data-copy-label="">Copy</span>
                  </button>
                  {"\n        "}
                </div>
              </div>
              <a href="https://github.com/Bearisbug/imbo#self-hosting" className="state-layer focus-ring inline-flex items-center justify-center gap-2 rounded-lp-button font-medium whitespace-nowrap transition-transform duration-(--lp-dur-fast) ease-(--lp-ease) active:scale-[0.97] h-11 px-5 text-base lp-hair-strong text-lp-fg w-full">
                Self-hosting guide
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 17 17 7M8 7h9v9" />
                </svg>
              </a>
            </div>
          </article>
        </div>
      </div>
      {"\n  "}
    </div>
  </section>
  <Island run={pricing1} />
    </>
  );
}
