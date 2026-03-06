/**
 * als-parser.service.ts
 *
 * Parses Ableton Live .als files (gzip-compressed XML) to extract
 * which VST2/VST3 plugins are used in the project.
 */
import * as fs from 'fs'
import * as zlib from 'zlib'
import { XMLParser } from 'fast-xml-parser'

export interface AlsPluginInfo {
  name: string
  format: 'VST2' | 'VST3'
  fileName?: string
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['AudioTrack', 'MidiTrack', 'GroupTrack', 'ReturnTrack', 'PluginDevice'].includes(name)
})

/**
 * Extract all third-party VST/VST3 plugins from an Ableton .als file.
 * Returns deduplicated list of plugin names and formats.
 */
export function extractPluginsFromAls(alsPath: string): AlsPluginInfo[] {
  try {
    const compressed = fs.readFileSync(alsPath)
    const xml = zlib.gunzipSync(compressed).toString('utf-8')
    const parsed = xmlParser.parse(xml)

    const plugins: AlsPluginInfo[] = []
    const seen = new Set<string>()

    const liveset = parsed?.Ableton?.LiveSet
    if (!liveset) return []

    const tracks = liveset.Tracks
    if (!tracks) return []

    // Iterate all track types
    const trackTypes = ['AudioTrack', 'MidiTrack', 'GroupTrack', 'ReturnTrack']
    for (const trackType of trackTypes) {
      const trackList = tracks[trackType]
      if (!trackList) continue

      const arr = Array.isArray(trackList) ? trackList : [trackList]
      for (const track of arr) {
        extractFromDeviceChain(track?.DeviceChain, plugins, seen)
      }
    }

    // Also check the master track
    if (liveset.MasterTrack) {
      extractFromDeviceChain(liveset.MasterTrack?.DeviceChain, plugins, seen)
    }

    return plugins
  } catch (err) {
    console.error(`[ALS Parser] Failed to parse ${alsPath}:`, err)
    return []
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
