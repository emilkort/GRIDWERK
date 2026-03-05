// Camelot Wheel — harmonic mixing key mapping
// Analyzer outputs: "C maj", "A min", "F# maj", "G# min" (sharps only, space-separated)

export interface CamelotPosition {
  num: number      // 1–12
  mode: 'A' | 'B' // A = minor, B = major
  label: string    // e.g. "8B"
}

// Maps analyzer key string → Camelot position
const KEY_TO_CAMELOT: Record<string, CamelotPosition> = {
  // Major keys (B = major ring)
  'C maj':  { num: 8,  mode: 'B', label: '8B'  },
  'C# maj': { num: 3,  mode: 'B', label: '3B'  },
  'D maj':  { num: 10, mode: 'B', label: '10B' },
  'D# maj': { num: 5,  mode: 'B', label: '5B'  },
  'E maj':  { num: 12, mode: 'B', label: '12B' },
  'F maj':  { num: 7,  mode: 'B', label: '7B'  },
  'F# maj': { num: 2,  mode: 'B', label: '2B'  },
  'G maj':  { num: 9,  mode: 'B', label: '9B'  },
  'G# maj': { num: 4,  mode: 'B', label: '4B'  },
  'A maj':  { num: 11, mode: 'B', label: '11B' },
  'A# maj': { num: 6,  mode: 'B', label: '6B'  },
  'B maj':  { num: 1,  mode: 'B', label: '1B'  },
  // Minor keys (A = minor ring)
  'C min':  { num: 5,  mode: 'A', label: '5A'  },
  'C# min': { num: 12, mode: 'A', label: '12A' },
  'D min':  { num: 7,  mode: 'A', label: '7A'  },
  'D# min': { num: 2,  mode: 'A', label: '2A'  },
  'E min':  { num: 9,  mode: 'A', label: '9A'  },
  'F min':  { num: 4,  mode: 'A', label: '4A'  },
  'F# min': { num: 11, mode: 'A', label: '11A' },
  'G min':  { num: 6,  mode: 'A', label: '6A'  },
  'G# min': { num: 1,  mode: 'A', label: '1A'  },
  'A min':  { num: 8,  mode: 'A', label: '8A'  },
  'A# min': { num: 3,  mode: 'A', label: '3A'  },
  'B min':  { num: 10, mode: 'A', label: '10A' },
}

// 12 colors cycling the visible spectrum — looks great on dark backgrounds
const CAMELOT_COLORS: Record<number, string> = {
  1:  '#FF5252', // red       (G# min / B maj)
  2:  '#FF7043', // deep-orange
  3:  '#FFA726', // orange    (A# min / C# maj)
  4:  '#FFEE58', // yellow
  5:  '#C6E249', // lime
  6:  '#66BB6A', // green     (G min / A# maj)
  7:  '#26C6DA', // cyan
  8:  '#42A5F5', // blue      (A min / C maj — the "home" key)
  9:  '#5C6BC0', // indigo
  10: '#7E57C2', // deep-purple
  11: '#AB47BC', // purple
  12: '#EC407A', // pink
}

export function getCamelotPosition(key: string): CamelotPosition | null {
  return KEY_TO_CAMELOT[key] ?? null
}

export function getCamelotColor(key: string): string | null {
  const pos = KEY_TO_CAMELOT[key]
  return pos ? CAMELOT_COLORS[pos.num] : null
}

export function getCamelotLabel(key: string): string | null {
  return KEY_TO_CAMELOT[key]?.label ?? null
}

/** Returns true if keyB is harmonically compatible with keyA (same or ±1 on the Camelot ring, or parallel minor/major) */
export function isCompatibleKey(keyA: string, keyB: string): boolean {
  const a = KEY_TO_CAMELOT[keyA]
  const b = KEY_TO_CAMELOT[keyB]
  if (!a || !b) return false

  // Same number = always compatible (parallel major/minor)
  if (a.num === b.num) return true

  // Adjacent numbers on same mode ring = compatible
  const prev = ((a.num - 2 + 12) % 12) + 1
  const next = (a.num % 12) + 1
  if (b.mode === a.mode && (b.num === prev || b.num === next)) return true

  return false
}

/** Sort key strings in Camelot order (1A, 1B, 2A, 2B, …) */
export function sortKeysCamelot(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const pa = KEY_TO_CAMELOT[a]
    const pb = KEY_TO_CAMELOT[b]
    if (!pa && !pb) return a.localeCompare(b)
    if (!pa) return 1
    if (!pb) return -1
    if (pa.num !== pb.num) return pa.num - pb.num
    return pa.mode.localeCompare(pb.mode) // A before B
  })
}
