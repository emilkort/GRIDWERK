/**
 * als-parser.service.ts
 *
 * Parses Ableton Live .als files (gzip-compressed XML) to extract
 * plugins, BPM, key, track info, samples used, and arrangement markers.
 */
import * as fs from 'fs'
import * as zlib from 'zlib'
import { XMLParser } from 'fast-xml-parser'

export interface AlsPluginInfo {
  name: string
  format: 'VST2' | 'VST3'
  fileName?: string
}

export interface AlsTrackInfo {
  name: string
  type: 'audio' | 'midi' | 'group' | 'return' | 'master'
  color: number
}

export interface AlsProjectInfo {
  bpm: number | null
  timeSignature: string | null
  musicalKey: string | null
  trackCount: number
  tracks: AlsTrackInfo[]
  plugins: AlsPluginInfo[]
  samplePaths: string[]
  markers: string[]
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => [
    'AudioTrack', 'MidiTrack', 'GroupTrack', 'ReturnTrack',
    'PluginDevice', 'Locator', 'AudioClip', 'MidiClip',
    'ClipSlot', 'ClipSlotList'
  ].includes(name)
})

/**
 * Full parse of an .als file — returns all extractable project metadata.
 */
export function parseAlsFile(alsPath: string): AlsProjectInfo | null {
  try {
    const compressed = fs.readFileSync(alsPath)
    const xml = zlib.gunzipSync(compressed).toString('utf-8')
    const parsed = xmlParser.parse(xml)

    const liveset = parsed?.Ableton?.LiveSet
    if (!liveset) return null

    const plugins: AlsPluginInfo[] = []
    const pluginSeen = new Set<string>()
    const tracks: AlsTrackInfo[] = []
    const samplePaths: string[] = []
    const sampleSeen = new Set<string>()

    // ── BPM ──
    // Live 12 uses "MainTrack", Live 11 and earlier use "MasterTrack"
    const masterTrack = liveset.MainTrack ?? liveset.MasterTrack
    const tempo = masterTrack?.DeviceChain?.Mixer?.Tempo ??
                  masterTrack?.Mixer?.Tempo
    const bpm = parseFloat(getAttrValue(tempo?.Manual)) || null

    // ── Time signature ──
    let timeSignature: string | null = null
    const tsSrc = masterTrack?.DeviceChain?.Mixer?.TimeSignature ??
                  masterTrack?.TimeSignature
    const tsNum = tsSrc?.TimeSignatures?.RemoteableTimeSignature?.Numerator
    const tsDen = tsSrc?.TimeSignatures?.RemoteableTimeSignature?.Denominator
    if (tsNum && tsDen) {
      const num = parseInt(getAttrValue(tsNum)) || 4
      const den = parseInt(getAttrValue(tsDen)) || 4
      timeSignature = `${num}/${den}`
    }

    // ── Key / Scale ──
    // Live 12: ScaleInformation.Root (number) + ScaleInformation.Name (numeric index: 0=Major, 1=Minor, ...)
    // Live 11: ScaleInformation.RootNote + ScaleInformation.Name (string like "Minor")
    let musicalKey: string | null = null
    const scaleInfo = liveset.ScaleInformation
    if (scaleInfo) {
      const rootNote = parseInt(getAttrValue(scaleInfo.RootNote ?? scaleInfo.Root))
      const scaleName = getAttrValue(scaleInfo.Name)
      // Live 12 uses numeric name (0=Major, 1=Minor), Live 11 uses string
      const isMinor = scaleName === '1' || scaleName.toLowerCase().includes('minor')
      if (!isNaN(rootNote) && rootNote >= 0) {
        const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        musicalKey = `${NOTES[rootNote % 12]} ${isMinor ? 'Minor' : 'Major'}`
      }
    }

    // ── Tracks ──
    const trackTypeMap: [string, AlsTrackInfo['type']][] = [
      ['AudioTrack', 'audio'], ['MidiTrack', 'midi'],
      ['GroupTrack', 'group'], ['ReturnTrack', 'return']
    ]

    const allTracks = liveset.Tracks
    if (allTracks) {
      for (const [xmlType, infoType] of trackTypeMap) {
        const trackList = allTracks[xmlType]
        if (!trackList) continue
        const arr = Array.isArray(trackList) ? trackList : [trackList]
        for (const track of arr) {
          const name = getAttrValue(track?.Name?.EffectiveName) ||
                       getAttrValue(track?.Name?.UserName) || ''
          const color = parseInt(getAttrValue(track?.Color)) || 0
          tracks.push({ name, type: infoType, color })

          // Extract plugins from device chain
          extractFromDeviceChain(track?.DeviceChain, plugins, pluginSeen)

          // Extract sample paths from audio clips
          extractSamplesFromTrack(track, samplePaths, sampleSeen)

          // For audio tracks, check if the track name looks like a plugin
          // (Maschine exports name audio tracks after the source plugin)
          if (infoType === 'audio' && name) {
            extractPluginFromTrackName(name, plugins, pluginSeen)
          }
        }
      }
    }

    // Master/Main track plugins
    if (masterTrack) {
      extractFromDeviceChain(masterTrack.DeviceChain, plugins, pluginSeen)
    }

    // ── Locators / Markers ──
    const markers: string[] = []
    const locators = liveset.Locators?.Locators?.Locator
    if (locators) {
      const locArr = Array.isArray(locators) ? locators : [locators]
      for (const loc of locArr) {
        const name = getAttrValue(loc?.Name)
        if (name) markers.push(name)
      }
    }

    return {
      bpm,
      timeSignature,
      musicalKey,
      trackCount: tracks.filter((t) => t.type === 'audio' || t.type === 'midi').length,
      tracks,
      plugins,
      samplePaths,
      markers
    }
  } catch (err) {
    console.error(`[ALS Parser] Failed to parse ${alsPath}:`, err)
    return null
  }
}

/**
 * Extract all third-party VST/VST3 plugins from an Ableton .als file.
 * Returns deduplicated list of plugin names and formats.
 */
export function extractPluginsFromAls(alsPath: string): AlsPluginInfo[] {
  const info = parseAlsFile(alsPath)
  return info?.plugins ?? []
}

/** Known DAW/instrument names that appear as audio track names from Maschine exports */
const KNOWN_INSTRUMENTS = new Set([
  'maschine', 'massive', 'massive x', 'fm8', 'reaktor', 'kontakt',
  'battery', 'monark', 'prism', 'razor', 'absynth', 'guitar rig',
  'serum', 'vital', 'omnisphere', 'sylenth1', 'diva', 'repro',
  'pigments', 'phase plant', 'phaseplant', 'spire', 'hive',
  'analog lab', 'keyscape', 'nexus', 'electra', 'avenger',
  'dune', 'zebra', 'u-he', 'fabfilter', 'soundtoys', 'valhalla',
  'ozone', 'neutron', 'trash', 'decapitator', 'echoboy',
  'pro-q', 'pro-l', 'pro-r', 'pro-c', 'pro-mb'
])

function extractPluginFromTrackName(
  name: string,
  plugins: AlsPluginInfo[],
  seen: Set<string>
): void {
  const lower = name.toLowerCase().trim()
  // Check if the track name matches a known instrument/plugin
  for (const inst of KNOWN_INSTRUMENTS) {
    if (lower === inst || lower.startsWith(inst + ' ') || lower.endsWith(' ' + inst)) {
      const key = `${name}:TRACK`
      if (!seen.has(key)) {
        seen.add(key)
        plugins.push({ name, format: 'VST2' }) // format approximate
      }
      return
    }
  }
  // Also detect pattern: "PluginName - PatchName" or "PluginName (something)"
  const dashMatch = name.match(/^([A-Z][a-zA-Z0-9 ]+?)\s*[-–]\s/)
  if (dashMatch) {
    const candidate = dashMatch[1].trim().toLowerCase()
    if (KNOWN_INSTRUMENTS.has(candidate)) {
      const key = `${dashMatch[1].trim()}:TRACK`
      if (!seen.has(key)) {
        seen.add(key)
        plugins.push({ name: dashMatch[1].trim(), format: 'VST2' })
      }
    }
  }
}

function extractSamplesFromTrack(
  track: any,
  samples: string[],
  seen: Set<string>
): void {
  // Check arrangement clips
  const mainSeq = track?.DeviceChain?.MainSequencer
  if (!mainSeq) return

  // Arrangement audio clips
  const clipSlotList = mainSeq?.Sample?.ArrangerAutomation?.Events?.AudioClip ??
                       mainSeq?.ClipTimeable?.ArrangerAutomation?.Events?.AudioClip
  collectSampleRefs(clipSlotList, samples, seen)

  // Session view clips
  const sessionSlots = mainSeq?.ClipSlotList?.ClipSlot
  if (sessionSlots) {
    const slots = Array.isArray(sessionSlots) ? sessionSlots : [sessionSlots]
    for (const slot of slots) {
      const clip = slot?.ClipSlot?.Value?.AudioClip
      if (clip) collectSampleRefs([clip], samples, seen)
    }
  }
}

function collectSampleRefs(clips: any, samples: string[], seen: Set<string>): void {
  if (!clips) return
  const arr = Array.isArray(clips) ? clips : [clips]
  for (const clip of arr) {
    const fileRef = clip?.SampleRef?.FileRef ??
                    clip?.Sample?.SampleRef?.FileRef
    if (!fileRef) continue
    const path = getAttrValue(fileRef.Path) || getAttrValue(fileRef.Name) || ''
    if (path && !seen.has(path)) {
      seen.add(path)
      samples.push(path)
    }
  }
}

function extractFromDeviceChain(
  deviceChain: any,
  plugins: AlsPluginInfo[],
  seen: Set<string>
): void {
  if (!deviceChain) return

  // Ableton nests DeviceChain > DeviceChain > Devices, but sometimes it's just DeviceChain > Devices
  const devices = deviceChain?.DeviceChain?.Devices ?? deviceChain?.Devices
  if (!devices) return

  const pluginDevices = devices.PluginDevice
  if (!pluginDevices) return

  const arr = Array.isArray(pluginDevices) ? pluginDevices : [pluginDevices]
  for (const pd of arr) {
    const desc = pd?.PluginDesc
    if (!desc) continue

    // VST2
    const vstInfo = desc.VstPluginInfo
    if (vstInfo) {
      const name = getAttrValue(vstInfo.PlugName) || getAttrValue(vstInfo.PluginName) || ''
      const fileName = getAttrValue(vstInfo.FileName) || ''
      if (name) {
        const key = `${name}:VST2`
        if (!seen.has(key)) {
          seen.add(key)
          plugins.push({ name, format: 'VST2', fileName: fileName || undefined })
        }
      }
    }

    // VST3
    const vst3Info = desc.Vst3PluginInfo
    if (vst3Info) {
      const name = getAttrValue(vst3Info.Name) || getAttrValue(vst3Info.PlugName) || ''
      if (name) {
        const key = `${name}:VST3`
        if (!seen.has(key)) {
          seen.add(key)
          plugins.push({ name, format: 'VST3' })
        }
      }
    }
  }

  // Recurse into grouped device chains (drum racks, instrument racks, etc.)
  // These can have nested Devices with more PluginDevice entries
  if (devices) {
    for (const key of Object.keys(devices)) {
      if (key === 'PluginDevice') continue
      const child = devices[key]
      if (!child) continue
      const childArr = Array.isArray(child) ? child : [child]
      for (const c of childArr) {
        // Look for nested DeviceChain inside device racks
        if (c?.Branches) {
          const branches = c.Branches
          for (const branchKey of Object.keys(branches)) {
            const branchList = branches[branchKey]
            const branchArr = Array.isArray(branchList) ? branchList : [branchList]
            for (const branch of branchArr) {
              extractFromDeviceChain(branch?.DeviceChain, plugins, seen)
            }
          }
        }
        if (c?.DeviceChain) {
          extractFromDeviceChain(c.DeviceChain, plugins, seen)
        }
      }
    }
  }
}

/** Extract @_Value from an XML element parsed by fast-xml-parser */
function getAttrValue(el: any): string {
  if (!el) return ''
  if (typeof el === 'string') return el
  return el['@_Value'] ?? ''
}
