import { Island } from "../islands/Island";
import asciiRain1 from "../islands/asciiRain1.js";

export function AsciiRain() {
  return (
    <>
  <canvas data-ascii-rain="" aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 block w-full h-full text-lp-fg" style={{ width: "100%", height: "100%" }} />
  <Island run={asciiRain1} />
    </>
  );
}
