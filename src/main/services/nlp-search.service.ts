// Natural Language Search — maps descriptive keywords to SQL filter conditions

interface NlpParseResult {
  conditions: string[]
  params: (string | number)[]
  remainingSearch: string
}

// Spectral descriptor keywords → SQL conditions
const DESCRIPTOR_MAP: [RegExp, string, (string | number)[]][] = [
  [/\bbright\b/i,   's.spectral_centroid > ?', [4000]],
  [/\bdark\b/i,     's.spectral_centroid < ?', [1000]],
  [/\bwarm\b/i,     's.spectral_centroid BETWEEN ? AND ? AND s.spectral_flatness < ?', [800, 3000, 0.15]],
  [/\bpunchy\b/i,   's.attack_time_ms < ?', [10]],
  [/\bsoft\b/i,     's.attack_time_ms > ?', [50]],
  [/\bnoisy\b/i,    's.spectral_flatness > ?', [0.4]],
  [/\btonal\b/i,    's.spectral_flatness < ?', [0.1]],
  [/\bbusy\b/i,     's.onset_count > ?', [4]],
  [/\bshort\b/i,    's.duration_ms < ?', [500]],
  [/\blong\b/i,     's.duration_ms > ?', [3000]],
]

// Category aliases → normalized category name
const CATEGORY_ALIASES: [RegExp, string][] = [
  [/\bkicks?\b/i,       'kick'],
  [/\bsnares?\b/i,      'snare'],
  [/\bhats?\b|\bhi[\s-]?hats?\b/i, 'hi-hat'],
  [/\bclaps?\b/i,       'clap'],
  [/\bpads?\b/i,        'pad'],
  [/\bbass(es)?\b/i,    'bass'],
  [/\bvocals?\b|\bvox\b/i, 'vocal'],
  [/\bloops?\b/i,       'loop'],
  [/\bfx\b|\beffects?\b/i, 'fx'],
  [/\bsynths?\b|\bleads?\b/i, 'synth'],
  [/\bkeys?\b|\bpianos?\b/i, 'keys'],
  [/\bguitars?\b/i,     'guitar'],
  [/\bpercs?\b|\bpercussion\b/i, 'percussion'],
  [/\bone[\s-]?shots?\b/i, 'one-shot'],
]

export function parseNaturalLanguageQuery(query: string): NlpParseResult {
  const conditions: string[] = []
  const params: (string | number)[] = []
  let remaining = query

  // Extract descriptor keywords
  for (const [pattern, sql, sqlParams] of DESCRIPTOR_MAP) {
    if (pattern.test(remaining)) {
      conditions.push(sql)
      params.push(...sqlParams)
      remaining = remaining.replace(pattern, '').trim()
    }
  }

  // Extract category aliases
  for (const [pattern, category] of CATEGORY_ALIASES) {
    if (pattern.test(remaining)) {
      conditions.push('s.category = ?')
      params.push(category)
      remaining = remaining.replace(pattern, '').trim()
      break // only one category per query
    }
  }

  // Clean up remaining text
  remaining = remaining.replace(/\s+/g, ' ').trim()

  return { conditions, params, remainingSearch: remaining }
}
