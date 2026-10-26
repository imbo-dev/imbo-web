import { createCn } from "cn/config"

// The brand type scale (tokens.shadcn.css --text-*) is a set of font sizes. Without telling the merger, it reads
// `text-body-strong` as a color and drops `text-primary-foreground` when a size class comes after it.
export const cn = createCn({
  extend: {
    classGroups: { "font-size": [{ text: ["caption", "label", "body", "body-strong", "body-large", "heading3", "heading2", "heading1", "code"] }] },
  },
})
