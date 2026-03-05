export const AUDIO_FORMATS: Record<string, string> = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.aiff': 'audio/aiff',
  '.aif': 'audio/aiff',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg'
}

export const VST_FORMATS = {
  VST2: '.dll',
  VST3: '.vst3'
} as const

export const PROJECT_FORMATS: Record<string, string> = {
  '.als': 'Ableton Live',
  '.mxprj': 'Maschine'
}

export function isAudioFile(ext: string): boolean {
  return ext.toLowerCase() in AUDIO_FORMATS
}

export function isVstFile(ext: string): boolean {
  const lower = ext.toLowerCase()
  return lower === '.dll' || lower === '.vst3'
}

export function isProjectFile(ext: string): boolean {
  return ext.toLowerCase() in PROJECT_FORMATS
}
