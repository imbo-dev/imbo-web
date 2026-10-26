import wordmark from "../../../../brand/releases/1.0.0/logo/imbo-wordmark-compact-dark.svg"

// Compact wordmark (brand/DESIGN.md「资产映射」: nav bars use it at 28–32 px canvas height).
export function Wordmark({ className }: { className?: string }) {
  return <img src={wordmark} alt="Imbo" width={62} height={28} className={className ?? "block h-7 w-auto"} />
}
