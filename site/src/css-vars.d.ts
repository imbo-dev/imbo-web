import "react";

// inline style objects carry CSS custom properties (--d, --acc, --cols) straight from the design
declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number;
  }
}
