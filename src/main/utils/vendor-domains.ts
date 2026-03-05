// Curated map of common VST plugin vendors to their website domains
export const KNOWN_VENDOR_DOMAINS: Record<string, string> = {
  'Xfer Records': 'xferrecords.com',
  FabFilter: 'fabfilter.com',
  'Valhalla DSP': 'valhalladsp.com',
  'Native Instruments': 'native-instruments.com',
  iZotope: 'izotope.com',
  Waves: 'waves.com',
  Soundtoys: 'soundtoys.com',
  'u-he': 'u-he.com',
  Arturia: 'arturia.com',
  Output: 'output.com',
  'Slate Digital': 'slatedigital.com',
  'Plugin Alliance': 'plugin-alliance.com',
  'Universal Audio': 'uaudio.com',
  Steinberg: 'steinberg.net',
  'IK Multimedia': 'ikmultimedia.com',
  Eventide: 'eventideaudio.com',
  Softube: 'softube.com',
  Kilohearts: 'kilohearts.com',
  Spectrasonics: 'spectrasonics.net',
  'TAL Software': 'tal-software.com',
  'TAL-Togu Audio Line': 'tal-software.com',
  'Vital Audio': 'vital.audio',
  'Cherry Audio': 'cherryaudio.com',
  'Spitfire Audio': 'spitfireaudio.com',
  Roland: 'roland.com',
  Toontrack: 'toontrack.com',
  Cableguys: 'cableguys.com',
  LennarDigital: 'lennardigital.com',
  'Reveal Sound': 'reveal-sound.com',
  'Sonic Academy': 'sonicacademy.com',
  'D16 Group': 'd16.pl',
  Brainworx: 'brainworx.audio',
  Sonnox: 'sonnox.com',
  'Melda Production': 'meldaproduction.com',
  MeldaProduction: 'meldaproduction.com',
  Voxengo: 'voxengo.com',
  'Tokyo Dawn Records': 'tokyodawn.net',
  TDR: 'tokyodawn.net',
  'Analog Obsession': 'analogobsession.com',
  'Acon Digital': 'acondigital.com',
  'Air Music Technology': 'airmusictech.com',
  Serum: 'xferrecords.com',
  'Cytomic': 'cytomic.com',
  'Goodhertz': 'goodhertz.com',
  'AudioThing': 'audiothing.net',
  'Klanghelm': 'klanghelm.com',
  'Tone2': 'tone2.com',
  'ValhallaDSP': 'valhalladsp.com',
  'Dada Life': 'tailorhits.com',
  'Polyverse Music': 'polyversemusic.com',
  'Sinevibes': 'sinevibes.com',
  'Sugar Audio': 'sugar-audio.com',
  'Unfiltered Audio': 'unfilteredaudio.com',
  'Newfangled Audio': 'newfangledaudio.com',
  'Baby Audio': 'babyaud.io',
  'BABY Audio': 'babyaud.io',
  'Devious Machines': 'deviousmachines.com',
  'Wavesfactory': 'wavesfactory.com',
  'Sonarworks': 'sonarworks.com',
  'SSL': 'solidstatelogic.com',
  'Solid State Logic': 'solidstatelogic.com',
  'Ableton': 'ableton.com',
  'Antares': 'antarestech.com',
  'Antares Audio Technologies': 'antarestech.com',
  'Celemony': 'celemony.com',
  'Rob Papen': 'robpapen.com',
  'Vengeance Sound': 'vengeance-sound.com',
  'Synapse Audio': 'synapse-audio.com',
  'Image-Line': 'image-line.com',
  'Camel Audio': 'camelaudio.com',
  'Oeksound': 'oeksound.com',
  'Sonible': 'sonible.com',
  'Accusonus': 'accusonus.com',
  'Zynaptiq': 'zynaptiq.com',
  'SoundSpot': 'soundspot.audio',
  'Denise Audio': 'denise.io',
  'Minimal Audio': 'minimalaudio.com',
  'Initial Audio': 'initialaudio.com',
  'W.A. Production': 'waproduction.com',
  'Glitchmachines': 'glitchmachines.com',
  'Audio Damage': 'audiodamage.com',
  'Credland Audio': 'credland.net',
  'Quiet Art': 'quiet-art.com',
  'KV331 Audio': 'kv331audio.com',
  'Waldorf': 'waldorfmusic.com',
  'Togu Audio Line': 'tal-software.com',
  'Korg': 'korg.com',
  'Yamaha': 'yamaha.com',
  'Akai': 'akaipro.com',
  'PreSonus': 'presonus.com',
  'Avid': 'avid.com',
  'MOTU': 'motu.com',
  'Lexicon': 'lexiconpro.com',
  'TC Electronic': 'tcelectronic.com'
}

export function guessVendorDomain(vendor: string): string | null {
  if (!vendor) return null

  // Direct lookup
  const known = KNOWN_VENDOR_DOMAINS[vendor]
  if (known) return known

  // Case-insensitive lookup
  const lowerVendor = vendor.toLowerCase()
  for (const [name, domain] of Object.entries(KNOWN_VENDOR_DOMAINS)) {
    if (name.toLowerCase() === lowerVendor) return domain
  }

  // Heuristic: strip common suffixes, lowercase, remove spaces → .com
  const cleaned = vendor
    .replace(/\b(Audio|Software|Music|Digital|Technologies?|Inc\.?|Ltd\.?|LLC|GmbH|Co\.?)\b/gi, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')

  if (cleaned.length >= 3) {
    return `${cleaned}.com`
  }

  return null
}
