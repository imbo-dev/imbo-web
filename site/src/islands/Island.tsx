import { useEffect, useRef } from "react";

type Run = (script: HTMLScriptElement) => void;

// Inert <script> at the position the Quilt draft had an inline script; the draft's code
// locates its elements relative to that node, so it runs once after mount with the node passed in.
export function Island({ run }: { run: Run }) {
  const ref = useRef<HTMLScriptElement>(null);
  useEffect(() => {
    if (ref.current) run(ref.current);
  }, [run]);
  return <script ref={ref} type="text/plain" />;
}
