import { z } from "zod"
import { t } from "@/i18n"

// Same rules the server applies (docs/DESIGN.md S2 email, S4 name: 1 to 32 characters, not all digits, no slash, no leading #).
export const emailSchema = z.string().trim().pipe(z.email({ error: () => t("Enter an email address like name@example.com.") }))

// Counted in characters as people see them (an emoji is one), not UTF-16 units.
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })
const chars = (v: string) => [...segmenter.segment(v)].length

export const nameSchema = z
  .string()
  .trim()
  .refine((v) => chars(v) >= 1, { error: () => t("Enter a name.") })
  .refine((v) => chars(v) <= 32, { error: () => t("Use 32 characters or fewer.") })
  .refine((v) => !/^\d+$/.test(v), { error: () => t("A name can't be only digits.") })
  .refine((v) => !v.includes("/"), { error: () => t("A name can't contain a slash.") })
  .refine((v) => !v.startsWith("#"), { error: () => t("A name can't start with #.") })

/** First error message, or undefined when the value is valid. */
export const problem = (schema: z.ZodType, value: string) => {
  const r = schema.safeParse(value)
  return r.success ? undefined : r.error.issues[0]?.message
}
