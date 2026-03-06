// Static lookup table mapping well-known plugin names to their correct vendor.
// Used as the highest-priority source for vendor data, overriding DLL/moduleinfo extraction.
// Plugin names are matched case-insensitively.

const PLUGIN_VENDOR_MAP: Record<string, string> = {
  // ── u-he ──────────────────────────────────────────────
  'Diva': 'u-he',
  'Repro-1': 'u-he',
  'Repro-5': 'u-he',
  'Repro': 'u-he',
  'Hive': 'u-he',
  'Hive 2': 'u-he',
  'Zebra2': 'u-he',
  'Zebra': 'u-he',
  'ZebraHZ': 'u-he',
  'ACE': 'u-he',
  'Bazille': 'u-he',
  'Presswerk': 'u-he',
  'Satin': 'u-he',
  'Uhbik': 'u-he',
  'Colour Copy': 'u-he',
  'Filterscape': 'u-he',
  'MFM2': 'u-he',
  'Triple Cheese': 'u-he',
  'Tyrell N6': 'u-he',
  'Podolski': 'u-he',
  'Protoverb': 'u-he',
  'More Feedback Machine': 'u-he',

  // ── Output ────────────────────────────────────────────
  'Arcade': 'Output',
  'Portal': 'Output',
  'Thermal': 'Output',
  'Movement': 'Output',
  'Exhale': 'Output',
  'Rev': 'Output',
  'Signal': 'Output',
  'Substance': 'Output',
  'Analog Strings': 'Output',
  'Analog Brass & Winds': 'Output',

  // ── Xfer Records ──────────────────────────────────────
  'Serum': 'Xfer Records',
  'Serum FX': 'Xfer Records',
  'Serum Fx': 'Xfer Records',
  'SerumFX': 'Xfer Records',
  'Cthulhu': 'Xfer Records',
  'LFOTool': 'Xfer Records',
  'OTT': 'Xfer Records',
  'Nerve': 'Xfer Records',
  'DJM Filter': 'Xfer Records',

  // ── Native Instruments ────────────────────────────────
  'Kontakt': 'Native Instruments',
  'Kontakt 5': 'Native Instruments',
  'Kontakt 6': 'Native Instruments',
  'Kontakt 7': 'Native Instruments',
  'Massive': 'Native Instruments',
  'Massive X': 'Native Instruments',
  'Reaktor': 'Native Instruments',
  'Reaktor 6': 'Native Instruments',
  'Battery': 'Native Instruments',
  'Battery 4': 'Native Instruments',
  'FM8': 'Native Instruments',
  'Absynth': 'Native Instruments',
  'Absynth 5': 'Native Instruments',
  'Maschine': 'Native Instruments',
  'Guitar Rig': 'Native Instruments',
  'Guitar Rig 6': 'Native Instruments',
  'Guitar Rig 7': 'Native Instruments',
  'Razor': 'Native Instruments',
  'Monark': 'Native Instruments',
  'Prism': 'Native Instruments',
  'Rounds': 'Native Instruments',
  'Skanner XT': 'Native Instruments',
  'Form': 'Native Instruments',
  'Kinetic Treats': 'Native Instruments',
  'Flesh': 'Native Instruments',
  'Super 8': 'Native Instruments',
  'Replika': 'Native Instruments',
  'Replika XT': 'Native Instruments',
  'Raum': 'Native Instruments',
  'Supercharger': 'Native Instruments',
  'Supercharger GT': 'Native Instruments',
  'Transient Master': 'Native Instruments',
  'Solid Bus Comp': 'Native Instruments',
  'Solid Dynamics': 'Native Instruments',
  'Solid EQ': 'Native Instruments',
  'Enhanced EQ': 'Native Instruments',
  'Phasis': 'Native Instruments',
  'Choral': 'Native Instruments',
  'Flair': 'Native Instruments',
  'The Finger': 'Native Instruments',
  'Driver': 'Native Instruments',
  'RC 24': 'Native Instruments',
  'RC 48': 'Native Instruments',

  // ── FabFilter ─────────────────────────────────────────
  'Pro-Q': 'FabFilter',
  'Pro-Q 2': 'FabFilter',
  'Pro-Q 3': 'FabFilter',
  'Pro-Q 4': 'FabFilter',
  'Pro-C': 'FabFilter',
  'Pro-C 2': 'FabFilter',
  'Pro-L': 'FabFilter',
  'Pro-L 2': 'FabFilter',
  'Pro-R': 'FabFilter',
  'Pro-R 2': 'FabFilter',
  'Pro-MB': 'FabFilter',
  'Pro-DS': 'FabFilter',
  'Pro-G': 'FabFilter',
  'Saturn': 'FabFilter',
  'Saturn 2': 'FabFilter',
  'Timeless': 'FabFilter',
  'Timeless 2': 'FabFilter',
  'Timeless 3': 'FabFilter',
  'Volcano': 'FabFilter',
  'Volcano 2': 'FabFilter',
  'Volcano 3': 'FabFilter',
  'Simplon': 'FabFilter',
  'Twin': 'FabFilter',
  'Twin 2': 'FabFilter',
  'Twin 3': 'FabFilter',
  'Micro': 'FabFilter',
  'One': 'FabFilter',

  // ── Spectrasonics ─────────────────────────────────────
  'Omnisphere': 'Spectrasonics',
  'Omnisphere 2': 'Spectrasonics',
  'Trilian': 'Spectrasonics',
  'Keyscape': 'Spectrasonics',
  'Stylus RMX': 'Spectrasonics',

  // ── iZotope ───────────────────────────────────────────
  'Ozone': 'iZotope',
  'Ozone 9': 'iZotope',
  'Ozone 10': 'iZotope',
  'Ozone 11': 'iZotope',
  'Neutron': 'iZotope',
  'Neutron 3': 'iZotope',
  'Neutron 4': 'iZotope',
  'RX': 'iZotope',
  'Trash': 'iZotope',
  'Trash 2': 'iZotope',
  'Vocal Synth': 'iZotope',
  'VocalSynth': 'iZotope',
  'VocalSynth 2': 'iZotope',
  'Nectar': 'iZotope',
  'Nectar 3': 'iZotope',
  'Nectar 4': 'iZotope',
  'Stutter Edit': 'iZotope',
  'Stutter Edit 2': 'iZotope',
  'Insight': 'iZotope',
  'Insight 2': 'iZotope',
  'Tonal Balance Control': 'iZotope',
  'Relay': 'iZotope',
  'Vinyl': 'iZotope',
  // iZotope VST2 names use compact format (iZ prefix + no spaces)
  'iZNeutron3': 'iZotope',
  'iZNeutron3Compressor': 'iZotope',
  'iZNeutron3Equalizer': 'iZotope',
  'iZNeutron3Exciter': 'iZotope',
  'iZNeutron3Gate': 'iZotope',
  'iZNeutron3Sculptor': 'iZotope',
  'iZNeutron3TransientShaper': 'iZotope',
  'iZNeutron3VisualMixer': 'iZotope',
  'iZNeutron4': 'iZotope',
  'iZOzone9': 'iZotope',
  'iZOzone10': 'iZotope',
  'iZOzone11': 'iZotope',
  'iZTrash2': 'iZotope',
  'iZVocalSynth2': 'iZotope',

  // ── Soundtoys ─────────────────────────────────────────
  'Decapitator': 'Soundtoys',
  'EchoBoy': 'Soundtoys',
  'EchoBoy Jr': 'Soundtoys',
  'PrimalTap': 'Soundtoys',
  'Crystallizer': 'Soundtoys',
  'PanMan': 'Soundtoys',
  'Tremolator': 'Soundtoys',
  'FilterFreak': 'Soundtoys',
  'FilterFreak1': 'Soundtoys',
  'FilterFreak2': 'Soundtoys',
  'PhaseMistress': 'Soundtoys',
  'Devil-Loc': 'Soundtoys',
  'Devil-Loc Deluxe': 'Soundtoys',
  'Radiator': 'Soundtoys',
  'Sie-Q': 'Soundtoys',
  'Little AlterBoy': 'Soundtoys',
  'Little MicroShift': 'Soundtoys',
  'Little Plate': 'Soundtoys',
  'Soundtoys Effect Rack': 'Soundtoys',
  'Effect Rack': 'Soundtoys',
  'MicroShift': 'Soundtoys',
  'Alter Boy': 'Soundtoys',

  // ── Valhalla DSP ──────────────────────────────────────
  'ValhallaVintageVerb': 'Valhalla DSP',
  'VintageVerb': 'Valhalla DSP',
  'ValhallaRoom': 'Valhalla DSP',
  'ValhallaPlate': 'Valhalla DSP',
  'ValhallaShimmer': 'Valhalla DSP',
  'ValhallaDelay': 'Valhalla DSP',
  'ValhallaSupermassive': 'Valhalla DSP',
  'ValhallaSpaceModulator': 'Valhalla DSP',
  'ValhallaFreqEcho': 'Valhalla DSP',
  'ValhallaUberMod': 'Valhalla DSP',

  // ── Arturia ───────────────────────────────────────────
  'Pigments': 'Arturia',
  'Pigments 4': 'Arturia',
  'Mini V': 'Arturia',
  'Mini V3': 'Arturia',
  'Jup-8 V': 'Arturia',
  'Prophet V': 'Arturia',
  'CS-80 V': 'Arturia',
  'SEM V': 'Arturia',
  'Analog Lab': 'Arturia',
  'Analog Lab V': 'Arturia',
  'Comp TUBE-STA': 'Arturia',
  'Comp VCA-65': 'Arturia',
  'Comp FET-76': 'Arturia',
  'Pre 1973': 'Arturia',
  'Pre V76': 'Arturia',
  'Pre TridA': 'Arturia',
  'Delay TAPE-201': 'Arturia',
  'Rev PLATE-140': 'Arturia',
  'Rev SPRING-636': 'Arturia',
  'Rev INTENSITY': 'Arturia',
  'Bus FORCE': 'Arturia',
  'Chorus JUN-6': 'Arturia',

  // ── Waves ─────────────────────────────────────────────
  'SSL E-Channel': 'Waves',
  'SSL G-Master Buss Compressor': 'Waves',
  'CLA-2A': 'Waves',
  'CLA-76': 'Waves',
  'CLA Guitars': 'Waves',
  'CLA Vocals': 'Waves',
  'CLA Bass': 'Waves',
  'H-Delay': 'Waves',
  'H-Reverb': 'Waves',
  'H-Comp': 'Waves',
  'L1': 'Waves',
  'L2': 'Waves',
  'L3': 'Waves',
  'Renaissance Bass': 'Waves',
  'Renaissance Compressor': 'Waves',
  'Renaissance EQ': 'Waves',
  'Renaissance Vox': 'Waves',
  'Renaissance Reverb': 'Waves',
  'R-Vox': 'Waves',
  'R-Comp': 'Waves',
  'R-Bass': 'Waves',
  'OneKnob Louder': 'Waves',
  'OneKnob Wetter': 'Waves',

  // ── Slate Digital ─────────────────────────────────────
  'Virtual Mix Rack': 'Slate Digital',
  'VMR': 'Slate Digital',
  'Virtual Tape Machines': 'Slate Digital',
  'Virtual Console Collection': 'Slate Digital',
  'FG-X': 'Slate Digital',
  'Infinity EQ': 'Slate Digital',
  'Fresh Air': 'Slate Digital',
  'Eiosis AirEQ': 'Slate Digital',

  // ── Cableguys ─────────────────────────────────────────
  'ShaperBox': 'Cableguys',
  'ShaperBox 3': 'Cableguys',
  'VolumeShaper': 'Cableguys',
  'TimeShaper': 'Cableguys',
  'FilterShaper': 'Cableguys',
  'PanShaper': 'Cableguys',
  'HalfTime': 'Cableguys',
  'PanCake': 'Cableguys',
  'PanCake 2': 'Cableguys',
  'MidiShaper': 'Cableguys',
  'WideShaper': 'Cableguys',
  'CrushShaper': 'Cableguys',
  'NoiseShaper': 'Cableguys',

  // ── Dada Life ─────────────────────────────────────────
  'Sausage Fattener': 'Dada Life',
  'Endless Smile': 'Dada Life',
  'Birth of Frequency': 'Dada Life',

  // ── Polyverse Music ───────────────────────────────────
  'Manipulator': 'Polyverse Music',
  'Wider': 'Polyverse Music',
  'Gatekeeper': 'Polyverse Music',
  'Comet': 'Polyverse Music',
  'Supermodal': 'Polyverse Music',

  // ── Baby Audio ────────────────────────────────────────
  'Super VHS': 'Baby Audio',
  'Smooth Operator': 'Baby Audio',
  'Parallel Aggressor': 'Baby Audio',
  'Comeback Kid': 'Baby Audio',
  'TAIP': 'Baby Audio',
  'Crystalline': 'Baby Audio',
  'Spaced Out': 'Baby Audio',

  // ── Spitfire Audio ────────────────────────────────────
  'LABS': 'Spitfire Audio',
  'BBC Symphony Orchestra': 'Spitfire Audio',
  'Albion': 'Spitfire Audio',

  // ── Kilohearts ────────────────────────────────────────
  'Phase Plant': 'Kilohearts',
  'Snap Heap': 'Kilohearts',
  'Multipass': 'Kilohearts',
  'Disperser': 'Kilohearts',

  // ── Cherry Audio ──────────────────────────────────────
  'Voltage Modular': 'Cherry Audio',
  'Surrealistic MG-1': 'Cherry Audio',
  'DCO-106': 'Cherry Audio',
  'Memorymode': 'Cherry Audio',

  // ── LennarDigital ─────────────────────────────────────
  'Sylenth1': 'LennarDigital',
  'Sylenth': 'LennarDigital',

  // ── Reveal Sound ──────────────────────────────────────
  'Spire': 'Reveal Sound',

  // ── Rob Papen ─────────────────────────────────────────
  'Blade': 'Rob Papen',
  'Blue-II': 'Rob Papen',
  'Predator': 'Rob Papen',
  'Predator 2': 'Rob Papen',
  'SubBoomBass': 'Rob Papen',
  'Punch': 'Rob Papen',
  'RAW': 'Rob Papen',
  'Go2': 'Rob Papen',
  'RP-Verb': 'Rob Papen',
  'RP-Delay': 'Rob Papen',
  'RP-Distort': 'Rob Papen',

  // ── Vengeance Sound ───────────────────────────────────
  'Avenger': 'Vengeance Sound',

  // ── Antares ───────────────────────────────────────────
  'Auto-Tune': 'Antares',
  'Auto-Tune Pro': 'Antares',
  'Auto-Tune Access': 'Antares',
  'Auto-Tune Artist': 'Antares',
  'Harmony Engine': 'Antares',
  'AVOX': 'Antares',
  'Choir': 'Antares',

  // ── Minimal Audio ─────────────────────────────────────
  'Current': 'Minimal Audio',
  'Rift': 'Minimal Audio',
  'Cluster Delay': 'Minimal Audio',
  'Morph EQ': 'Minimal Audio',
  'Fuse Compressor': 'Minimal Audio',

  // ── Goodhertz ─────────────────────────────────────────
  'Vulf Compressor': 'Goodhertz',
  'Lossy': 'Goodhertz',
  'Tone Control': 'Goodhertz',
  'Faraday Limiter': 'Goodhertz',
  'CanOpener Studio': 'Goodhertz',

  // ── Devious Machines ──────────────────────────────────
  'Texture': 'Devious Machines',
  'Texturize': 'Devious Machines',
  'Duck': 'Devious Machines',
  'Infiltrator': 'Devious Machines',

  // ── Plugin Alliance ───────────────────────────────────
  'bx_console': 'Plugin Alliance',
  'bx_digital': 'Plugin Alliance',
  'bx_masterdesk': 'Plugin Alliance',

  // ── Softube ───────────────────────────────────────────
  'Console 1': 'Softube',
  'Tape': 'Softube',
  'Harmonics': 'Softube',
  'Saturation Knob': 'Softube',
  'Weiss Compressor/Limiter': 'Softube',
  'Tube-Tech CL 1B': 'Softube',

  // ── Eventide ──────────────────────────────────────────
  'Blackhole': 'Eventide',
  'MangledVerb': 'Eventide',
  'UltraTap': 'Eventide',
  'MicroPitch': 'Eventide',
  'H3000 Factory': 'Eventide',
  'Instant Phaser': 'Eventide',
  'Instant Flanger': 'Eventide',
  'TriceraChorus': 'Eventide',
  'SplitEQ': 'Eventide',

  // ── Toontrack ─────────────────────────────────────────
  'Superior Drummer': 'Toontrack',
  'Superior Drummer 3': 'Toontrack',
  'EZdrummer': 'Toontrack',
  'EZdrummer 2': 'Toontrack',
  'EZdrummer 3': 'Toontrack',
  'EZkeys': 'Toontrack',
  'EZmix': 'Toontrack',
  'EZbass': 'Toontrack',

  // ── Sonible ───────────────────────────────────────────
  'smart:comp': 'Sonible',
  'smart:EQ': 'Sonible',
  'smart:limit': 'Sonible',
  'entropy:EQ+': 'Sonible',
  'proximity:EQ+': 'Sonible',

  // ── Oeksound ──────────────────────────────────────────
  'soothe': 'Oeksound',
  'soothe2': 'Oeksound',
  'bloom': 'Oeksound',
  'spiff': 'Oeksound',

  // ── Newfangled Audio / Eventide ───────────────────────
  'Elevate': 'Newfangled Audio',
  'EQuivocate': 'Newfangled Audio',
  'Saturate': 'Newfangled Audio',
  'Pendulate': 'Newfangled Audio',
  'Generate': 'Newfangled Audio',

  // ── Unfiltered Audio ──────────────────────────────────
  'Sandman Pro': 'Unfiltered Audio',
  'Indent 2': 'Unfiltered Audio',
  'LION': 'Unfiltered Audio',
  'Zip': 'Unfiltered Audio',
  'G8': 'Unfiltered Audio',
  'BYOME': 'Unfiltered Audio',
  'Silo': 'Unfiltered Audio',
  'SpecOps': 'Unfiltered Audio',
  'Needlepoint': 'Unfiltered Audio',
  'Dent 2': 'Unfiltered Audio',

  // ── Wavesfactory ──────────────────────────────────────
  'Spectre': 'Wavesfactory',
  'Trackspacer': 'Wavesfactory',
  'Cassette': 'Wavesfactory',
  'SK10': 'Wavesfactory',

  // ── D16 Group ─────────────────────────────────────────
  'Lush-101': 'D16 Group',
  'LuSH-101': 'D16 Group',
  'Phoscyon': 'D16 Group',
  'Decimort': 'D16 Group',
  'Decimort 2': 'D16 Group',
  'Devastor': 'D16 Group',
  'Devastor 2': 'D16 Group',
  'Drumazon': 'D16 Group',
  'Frontier': 'D16 Group',
  'PunchBox': 'D16 Group',
  'Syntorus': 'D16 Group',
  'Syntorus 2': 'D16 Group',
  'Toraverb': 'D16 Group',
  'Toraverb 2': 'D16 Group',
  'Repeater': 'D16 Group',
  'Sigmund': 'D16 Group',
  'Antresol': 'D16 Group',

  // ── TAL Software ──────────────────────────────────────
  'TAL-NoiseMaker': 'TAL Software',
  'TAL-Reverb': 'TAL Software',
  'TAL-Reverb-4': 'TAL Software',
  'TAL-Chorus-LX': 'TAL Software',
  'TAL-Filter': 'TAL Software',
  'TAL-Filter-2': 'TAL Software',
  'TAL-U-NO-LX': 'TAL Software',
  'TAL-BassLine-101': 'TAL Software',
  'TAL-DAC': 'TAL Software',
  'TAL-Dub': 'TAL Software',
  'TAL-Pha': 'TAL Software',
  'TAL-Sampler': 'TAL Software',
  'TAL-Mod': 'TAL Software',

  // ── Cytomic ───────────────────────────────────────────
  'The Glue': 'Cytomic',
  'The Drop': 'Cytomic',
  'The Scream': 'Cytomic',

  // ── MeldaProduction ───────────────────────────────────
  'MAutoEqualizer': 'MeldaProduction',
  'MCompressor': 'MeldaProduction',
  'MEqualizer': 'MeldaProduction',
  'MLimiter': 'MeldaProduction',
  'MAutoPitch': 'MeldaProduction',
  'MFreeformAnalogEQ': 'MeldaProduction',
  'MFreeformEqualizer': 'MeldaProduction',

  // ── Voxengo ───────────────────────────────────────────
  'SPAN': 'Voxengo',
  'Elephant': 'Voxengo',
  'OldSkoolVerb': 'Voxengo',
  'MSED': 'Voxengo',
  'Marvel GEQ': 'Voxengo',
  'Marquis Compressor': 'Voxengo',

  // ── Tokyo Dawn Records ────────────────────────────────
  'TDR Nova': 'Tokyo Dawn Records',
  'TDR Kotelnikov': 'Tokyo Dawn Records',
  'TDR VOS SlickEQ': 'Tokyo Dawn Records',
  'TDR Molot GE': 'Tokyo Dawn Records',
  'Nova': 'Tokyo Dawn Records',
  'Kotelnikov': 'Tokyo Dawn Records',
  'SlickEQ': 'Tokyo Dawn Records',

  // ── Klanghelm ─────────────────────────────────────────
  'MJUC': 'Klanghelm',
  'DC8C': 'Klanghelm',
  'IVGI': 'Klanghelm',

  // ── IK Multimedia ─────────────────────────────────────
  'AmpliTube': 'IK Multimedia',
  'AmpliTube 5': 'IK Multimedia',
  'T-RackS': 'IK Multimedia',
  'MODO Bass': 'IK Multimedia',
  'MODO Drum': 'IK Multimedia',
  'SampleTank': 'IK Multimedia',
  'Syntronik': 'IK Multimedia',

  // ── Steinberg ─────────────────────────────────────────
  'HALion': 'Steinberg',
  'HALion Sonic': 'Steinberg',
  'Groove Agent': 'Steinberg',
  'Retrologue': 'Steinberg',
  'Padshop': 'Steinberg',
  'SpectraLayers': 'Steinberg',

  // ── Sonic Academy ─────────────────────────────────────
  'ANA': 'Sonic Academy',
  'ANA 2': 'Sonic Academy',
  'Kick 2': 'Sonic Academy',

  // ── Synapse Audio ─────────────────────────────────────
  'DUNE': 'Synapse Audio',
  'DUNE 2': 'Synapse Audio',
  'DUNE 3': 'Synapse Audio',
  'Obsession': 'Synapse Audio',
  'The Legend': 'Synapse Audio',

  // ── Vital Audio ───────────────────────────────────────
  'Vital': 'Vital Audio',

  // ── Andrew Huang ──────────────────────────────────────
  'Co-Producer': 'Andrew Huang',

  // ── Universal Audio ───────────────────────────────────
  'Capitol Chambers': 'Universal Audio',
  'Galaxy Tape Echo': 'Universal Audio',
  'Studer A800': 'Universal Audio',
  'Oxide Tape': 'Universal Audio',
  'Pultec EQP-1A': 'Universal Audio',
  'LA-2A': 'Universal Audio',
  '1176': 'Universal Audio',

  // ── Celemony ──────────────────────────────────────────
  'Melodyne': 'Celemony',

  // ── Image-Line ────────────────────────────────────────
  'Sytrus': 'Image-Line',
  'Harmor': 'Image-Line',
  'Harmless': 'Image-Line',
  'Vocodex': 'Image-Line',
  'Gross Beat': 'Image-Line',
  'Maximus': 'Image-Line',
  'FLEX': 'Image-Line',

  // ── Tone2 ─────────────────────────────────────────────
  'ElectraX': 'Tone2',
  'Electra2': 'Tone2',
  'Icarus': 'Tone2',
  'Icarus2': 'Tone2',
  'Gladiator': 'Tone2',
  'Saurus': 'Tone2',
  'FireStorm': 'Tone2',
  'Warlock': 'Tone2',

  // ── Waldorf ───────────────────────────────────────────
  'Largo': 'Waldorf',
  'PPG Wave 3.V': 'Waldorf',
  'Nave': 'Waldorf',
  'Blofeld': 'Waldorf',

  // ── KV331 Audio ───────────────────────────────────────
  'SynthMaster': 'KV331 Audio',
  'SynthMaster One': 'KV331 Audio',
  'SynthMaster 2': 'KV331 Audio',

  // ── Acon Digital ──────────────────────────────────────
  'DeVerberate': 'Acon Digital',
  'Equalize': 'Acon Digital',
  'DeFilter': 'Acon Digital',

  // ── AudioThing ────────────────────────────────────────
  'Fog Convolver': 'AudioThing',
  'Outer Space': 'AudioThing',
  'Springs': 'AudioThing',
  'Valves': 'AudioThing',
}

// Build a lowercase lookup map for case-insensitive matching
const LOOKUP_MAP = new Map<string, string>()
for (const [name, vendor] of Object.entries(PLUGIN_VENDOR_MAP)) {
  LOOKUP_MAP.set(name.toLowerCase(), vendor)
}

/**
 * Look up the correct vendor for a plugin by name.
 * Returns null if no match found.
 */
export function lookupPluginVendor(pluginName: string): string | null {
  if (!pluginName) return null
  const lower = pluginName.toLowerCase()

  // Direct case-insensitive lookup
  const direct = LOOKUP_MAP.get(lower)
  if (direct) return direct

  // Try without trailing version numbers: "Serum2" → "Serum"
  const stripped = pluginName.replace(/\s*\d+(\.\d+)*\s*$/, '').trim()
  if (stripped !== pluginName) {
    const match = LOOKUP_MAP.get(stripped.toLowerCase())
    if (match) return match
  }

  // Try without trailing "(x64)" or "_x64" suffixes
  const noArch = pluginName.replace(/[\s_]*\(?x(64|86)\)?$/i, '').trim()
  if (noArch !== pluginName) {
    const m = LOOKUP_MAP.get(noArch.toLowerCase())
    if (m) return m
  }

  // Try iZotope-style compound names: "iZNeutron3Sculptor" → try "Neutron 3", "Neutron"
  if (lower.startsWith('iz') && lower.length > 3) {
    const withoutIz = pluginName.slice(2) // "Neutron3Sculptor"
    // Try progressively shorter prefixes against the lookup
    for (const [key, vendor] of LOOKUP_MAP) {
      if (withoutIz.toLowerCase().startsWith(key)) {
        return vendor
      }
    }
  }

  // Try matching "PluginName FX" → "PluginName"
  const noFx = pluginName.replace(/\s+FX$/i, '').trim()
  if (noFx !== pluginName) {
    const m = LOOKUP_MAP.get(noFx.toLowerCase())
    if (m) return m
  }

  // Try removing ".32" suffix: "Effectrix.32" → "Effectrix"
  const noDotVersion = pluginName.replace(/\.\d+$/, '').trim()
  if (noDotVersion !== pluginName) {
    const m = LOOKUP_MAP.get(noDotVersion.toLowerCase())
    if (m) return m
  }

  // Try prefix matching — find longest matching key
  let bestMatch: { key: string; vendor: string } | null = null
  for (const [key, vendor] of LOOKUP_MAP) {
    if (lower.startsWith(key) && key.length >= 3) {
      if (!bestMatch || key.length > bestMatch.key.length) {
        bestMatch = { key, vendor }
      }
    }
  }
  if (bestMatch) return bestMatch.vendor

  return null
}
