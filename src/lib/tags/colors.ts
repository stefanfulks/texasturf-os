// Fixed swatch palette. tags.color stores the KEY; UI maps key -> Tailwind classes.
export const TAG_COLORS = [
  "slate", "red", "amber", "green", "blue",
  "violet", "pink", "teal", "orange", "gray",
] as const

export type TagColor = (typeof TAG_COLORS)[number]

// chip = background + text + border classes for a given color key.
export const TAG_COLOR_CLASSES: Record<TagColor, string> = {
  slate:  "bg-slate-100 text-slate-700 border-slate-200",
  red:    "bg-red-100 text-red-700 border-red-200",
  amber:  "bg-amber-100 text-amber-800 border-amber-200",
  green:  "bg-green-100 text-green-700 border-green-200",
  blue:   "bg-blue-100 text-blue-700 border-blue-200",
  violet: "bg-violet-100 text-violet-700 border-violet-200",
  pink:   "bg-pink-100 text-pink-700 border-pink-200",
  teal:   "bg-teal-100 text-teal-700 border-teal-200",
  orange: "bg-orange-100 text-orange-700 border-orange-200",
  gray:   "bg-gray-100 text-gray-700 border-gray-200",
}

export function chipClasses(color: string): string {
  return TAG_COLOR_CLASSES[(color as TagColor)] ?? TAG_COLOR_CLASSES.slate
}
