import * as path from 'path'
import * as fs from 'fs'
import { execFileSync } from 'child_process'

export function normalizePath(inputPath: string): string {
  return path.resolve(inputPath)
}

export function pathsEqual(a: string, b: string): boolean {
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()
}

export const DEFAULT_VST_PATHS = {
  VST3: ['C:\\Program Files\\Common Files\\VST3'],
  VST2: [
    'C:\\Program Files\\VSTPlugins',
    'C:\\Program Files\\Steinberg\\VSTPlugins',
    'C:\\Program Files\\Common Files\\VST2'
  ]
}

export const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.aiff', '.aif', '.flac', '.ogg'])

export const DAW_PROJECT_EXTENSIONS: Record<string, string> = {
  'Ableton Live': '.als',
  Maschine: '.mxprj'
}

export function resolveLnkTarget(lnkPath: string): string | null {
  if (process.platform !== 'win32') return null

  try {
    const psScript = `(New-Object -ComObject WScript.Shell).CreateShortcut('${lnkPath.replace(/'/g, "''")}').TargetPath`
    const result = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', psScript],
      { timeout: 5000, encoding: 'utf-8' }
    )
    const target = result.trim()
    if (!target) return null

    try {
      fs.statSync(target)
      return target
    } catch {
      return null
    }
  } catch {
    return null
  }
}
