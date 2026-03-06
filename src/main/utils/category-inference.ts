// Keyword-based category inference for VST plugins
// Used by both vst.service.ts (during scan) and enrichment.service.ts (during enrichment)

interface CategoryRule {
  keywords: RegExp
  category: string
  subcategory: string
}

// Patterns use \b at the START only. No trailing \b so "FilterFreak1", "Glitch2" etc. match.
// The trailing boundary is handled by allowing optional digits/version suffixes.
const CATEGORY_RULES: CategoryRule[] = [
  // === Instruments (check first — more specific names) ===
  { keywords: /\b(synth|serum|massive|vital|zebra|diva|pigments|omnisphere|phase\s?plant|sylenth|spire|avenger|hive|repro|ana\s?\d|surge|helm|alchemy|retrologue|padshop|rapid|wavetable|lush[\s-]?101|electra|icarus|saurus|dune|bazille|podolski|tyrell|ace|pendulate|generate)/i, category: 'Instrument', subcategory: 'Synth' },
  { keywords: /\b(piano|keys|grand|keyscape|ivory|alicia|noire|una\s?corda|the\s?grandeur|keyzone|addictive\s?keys|ez\s?keys)/i, category: 'Instrument', subcategory: 'Piano' },
  { keywords: /\b(drum|battery|maschine|addictive\s?drums|bfd|superior\s?drummer|ez\s?drummer|atlas|microtonic|spark|sitala|punch\s?box|kick\s?\d)/i, category: 'Instrument', subcategory: 'Drum Machine' },
  { keywords: /\b(orchestra|symphony|strings|brass|woodwind|bbc\s?symphony|spitfire|cinematic|opus|berlin|symphonic|labs)/i, category: 'Instrument', subcategory: 'Orchestral' },
  { keywords: /\b(sampler|kontakt|halion|structure|sample\s?one|tx16wx|grace|sforzando|sample\s?tank)/i, category: 'Instrument', subcategory: 'Sampler' },
  { keywords: /\b(arcade|loop\s?player|looper|slicer)/i, category: 'Instrument', subcategory: 'Loop Player' },
  { keywords: /\b(trilian|modo\s?bass|sub\s?bass|ez\s?bass)/i, category: 'Instrument', subcategory: 'Bass' },
  { keywords: /\b(guitar\s?rig|modo\s?guitar|amp\s?sim|helix\s?native|bias\s?fx|amplitube)/i, category: 'Instrument', subcategory: 'Guitar' },

  // === Effects ===
  { keywords: /\b(eq|pro[\s-]?q|equali|linear\s?phase|free[\s-]?q|tone[\s-]?eq|pulsar|graphic\s?eq|parametric|freq|slick\s?eq|split\s?eq)/i, category: 'Effect', subcategory: 'EQ' },
  { keywords: /\b(compressor|comp[\s-]|limiter|la[\s-]?2a|1176|ssl[\s-]?g|opto|vca|pro[\s-]?c|pro[\s-]?l|pro[\s-]?mb|multiband|maximizer|l[\s-]?\d|kotelnikov|dc8c|molot|mjuc|sausage\s?fattener|smart[\s:]?comp|elevate|fuse\s?comp)/i, category: 'Effect', subcategory: 'Dynamics' },
  { keywords: /\b(reverb|verb|room|hall|plate|spring|convolution|valhalla|space|shimmer|supermassive|raum|neoverb|tai\s?chi|blackhole|little\s?plate|toraverb|protoverb)/i, category: 'Effect', subcategory: 'Reverb' },
  { keywords: /\b(delay|echo|dly|timeless|replika|h[\s-]?delay|echoboy|repeater|crystalliz|colour\s?copy|comeback\s?kid|primal\s?tap)/i, category: 'Effect', subcategory: 'Delay' },
  { keywords: /\b(auto[\s-]?tune|pitch[\s-]?correct|melodyne|waves\s?tune|auto[\s-]?key)/i, category: 'Effect', subcategory: 'Pitch Correction' },
  { keywords: /\b(distortion|overdrive|saturator|saturat|decapitator|trash|devil[\s-]?loc|clipper|exciter|heat|warm|thermal|decimort|devastor|satin|tape)/i, category: 'Effect', subcategory: 'Distortion' },
  { keywords: /\b(chorus|flanger|phaser|ensemble|dimension|rotary|vibrato|tremolo|modulation|phasis|choral|flair|chorus[\s-]?jx|syntorus)/i, category: 'Effect', subcategory: 'Modulation' },
  { keywords: /\b(filter|filterfreak|autofilter|wow[\s-]?filter|morph|the\s?drop)/i, category: 'Effect', subcategory: 'Filter' },
  { keywords: /\b(gate|expander|noise[\s-]?gate|gatekeeper|g8)/i, category: 'Effect', subcategory: 'Gate' },
  { keywords: /\b(meter|analyzer|analyser|span|insight|levels|loudness|goniometer|oscilloscope|visual|sigmund)/i, category: 'Effect', subcategory: 'Analyzer' },
  { keywords: /\b(de[\s-]?esser|de[\s-]?noise|denois|de[\s-]?hum|de[\s-]?click|noise[\s-]?reduction|rx\s?\d|restoration|repair|spectral[\s-]?clean|soothe|de[\s-]?verb)/i, category: 'Effect', subcategory: 'Restoration' },
  { keywords: /\b(channel[\s-]?strip|console|ssl[\s-]|neve|api[\s-]?\d|bx[\s_]?console)/i, category: 'Effect', subcategory: 'Channel Strip' },
  { keywords: /\b(ozone|t[\s-]?racks|final[\s-]?mix|master[\s-]?ing|smart[\s:]?limit)/i, category: 'Effect', subcategory: 'Mastering' },
  { keywords: /\b(vocoder|vocal|harmony|doubler|formant|little\s?alter\s?boy|manipulator|alter\s?boy|nectar|vocal\s?synth)/i, category: 'Effect', subcategory: 'Vocal' },
  { keywords: /\b(stereo|imager|widener|mid[\s-]?side|spatial|surround|binaural|atmos|panpot|wider|micro\s?shift|little\s?micro)/i, category: 'Effect', subcategory: 'Spatial' },
  { keywords: /\b(utility|gain|trim|polarity|mono|routing|relay)/i, category: 'Effect', subcategory: 'Utility' },
  { keywords: /\b(trackspacer|duck|side[\s-]?chain)/i, category: 'Effect', subcategory: 'Sidechain' },

  // === Catch-all broad patterns (lower priority) ===
  { keywords: /\b(effect|fx|rack|glitch|stutter|creative|shaperbox|portal|infiltrator|movement)/i, category: 'Effect', subcategory: 'Multi-Effect' },
  { keywords: /\b(headphone|monitor|reference|sonarworks|tonal\s?balance|check|can\s?opener)/i, category: 'Effect', subcategory: 'Monitoring' },
]

export function inferCategoryFromName(pluginName: string, vendor: string | null): { category: string; subcategory: string } | null {
  const searchText = `${pluginName} ${vendor || ''}`
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.test(searchText)) {
      return { category: rule.category, subcategory: rule.subcategory }
    }
  }
  return null
}
