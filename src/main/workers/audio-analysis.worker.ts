import * as fs from 'node:fs'
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'
import type { AnalysisResultData } from './audio-analysis.protocol'

// ============================================================
// Types
// ============================================================

interface PcmData {
  samples: Float32Array
  sampleRate: number
}

// ============================================================
// PCM Decoding (WAV, AIFF, ffmpeg fallback)
// ============================================================

function decodePcm(filePath: string): PcmData | null {
  try {
    const ext = path.extname(filePath).toLowerCase()
    if (ext === '.wav') {
      return decodeWav(fs.readFileSync(filePath))
    }
    if (ext === '.aiff' || ext === '.aif') {
      return decodeAiff(fs.readFileSync(filePath))
    }
    // MP3, FLAC, OGG, etc. — try ffmpeg
    return decodeWithFfmpeg(filePath)
  } catch (err) {
    console.error(`[Worker] Failed to decode PCM from ${filePath}:`, err)
    return null
  }
}

function decodeWav(buffer: Buffer): PcmData | null {
  if (buffer.length < 44) return null
  const riff = buffer.toString('ascii', 0, 4)
  const wave = buffer.toString('ascii', 8, 12)
  if (riff !== 'RIFF' || wave !== 'WAVE') return null

  let offset = 12
  let fmtFound = false
  let sampleRate = 44100
  let channels = 1
  let bitsPerSample = 16
  let audioFormat = 1

  while (offset < buffer.length - 8) {
    const chunkId = buffer.toString('ascii', offset, offset + 4)
    const chunkSize = buffer.readUInt32LE(offset + 4)

    if (chunkId === 'fmt ') {
      audioFormat = buffer.readUInt16LE(offset + 8)
      channels = buffer.readUInt16LE(offset + 10)
      sampleRate = buffer.readUInt32LE(offset + 12)
      bitsPerSample = buffer.readUInt16LE(offset + 22)
      fmtFound = true
    }

    if (chunkId === 'data' && fmtFound) {
      if (audioFormat !== 1 && audioFormat !== 3) return null

      const dataStart = offset + 8
      const dataEnd = Math.min(dataStart + chunkSize, buffer.length)
      const bytesPerSample = bitsPerSample / 8
      const totalSamples = Math.floor((dataEnd - dataStart) / (bytesPerSample * channels))
      const monoSamples = new Float32Array(totalSamples)

      if (audioFormat === 3 && bitsPerSample === 32) {
        for (let i = 0; i < totalSamples; i++) {
          let sum = 0
          for (let ch = 0; ch < channels; ch++) {
            const pos = dataStart + (i * channels + ch) * 4
            if (pos + 4 <= buffer.length) sum += buffer.readFloatLE(pos)
          }
          monoSamples[i] = sum / channels
        }
      } else if (bitsPerSample === 16) {
        for (let i = 0; i < totalSamples; i++) {
          let sum = 0
          for (let ch = 0; ch < channels; ch++) {
            const pos = dataStart + (i * channels + ch) * 2
            if (pos + 2 <= buffer.length) sum += buffer.readInt16LE(pos) / 32768
          }
          monoSamples[i] = sum / channels
        }
      } else if (bitsPerSample === 24) {
        for (let i = 0; i < totalSamples; i++) {
          let sum = 0
          for (let ch = 0; ch < channels; ch++) {
            const pos = dataStart + (i * channels + ch) * 3
            if (pos + 3 <= buffer.length) {
              const val = buffer[pos] | (buffer[pos + 1] << 8) | (buffer[pos + 2] << 16)
              const signed = val > 0x7fffff ? val - 0x1000000 : val
              sum += signed / 8388608
            }
          }
          monoSamples[i] = sum / channels
        }
      } else if (bitsPerSample === 32 && audioFormat === 1) {
        for (let i = 0; i < totalSamples; i++) {
          let sum = 0
          for (let ch = 0; ch < channels; ch++) {
            const pos = dataStart + (i * channels + ch) * 4
            if (pos + 4 <= buffer.length) sum += buffer.readInt32LE(pos) / 2147483648
          }
          monoSamples[i] = sum / channels
        }
      } else {
        return null
      }

      return { samples: monoSamples, sampleRate }
    }

    offset += 8 + chunkSize
    if (chunkSize % 2 !== 0) offset++
  }

  return null
}

// ============================================================
// AIFF PCM Decoding
// ============================================================

function readIeeeExtended(buf: Buffer, off: number): number {
  const exponent = ((buf[off] & 0x7f) << 8) | buf[off + 1]
  let mantissa = 0
  for (let i = 0; i < 8; i++) {
    mantissa = mantissa * 256 + buf[off + 2 + i]
  }
  if (exponent === 0 && mantissa === 0) return 0
  const sign = buf[off] & 0x80 ? -1 : 1
  return sign * mantissa * Math.pow(2, exponent - 16383 - 63)
}

function decodeAiff(buffer: Buffer): PcmData | null {
  if (buffer.length < 12) return null
  const form = buffer.toString('ascii', 0, 4)
  const aiff = buffer.toString('ascii', 8, 12)
  if (form !== 'FORM' || (aiff !== 'AIFF' && aiff !== 'AIFC')) return null

  let sampleRate = 44100
  let channels = 1
  let bitsPerSample = 16
  let offset = 12

  while (offset < buffer.length - 8) {
    const chunkId = buffer.toString('ascii', offset, offset + 4)
    const chunkSize = buffer.readUInt32BE(offset + 4)

    if (chunkId === 'COMM') {
      channels = buffer.readUInt16BE(offset + 8)
      bitsPerSample = buffer.readUInt16BE(offset + 14)
      sampleRate = readIeeeExtended(buffer, offset + 16)
    }

    if (chunkId === 'SSND') {
      const ssndOffset = buffer.readUInt32BE(offset + 8)
      const dataStart = offset + 16 + ssndOffset
      const dataEnd = Math.min(offset + 8 + chunkSize, buffer.length)
      const bytesPerSample = bitsPerSample / 8
      const totalSamples = Math.floor((dataEnd - dataStart) / (bytesPerSample * channels))
      const monoSamples = new Float32Array(totalSamples)

      if (bitsPerSample === 16) {
        for (let i = 0; i < totalSamples; i++) {
          let sum = 0
          for (let ch = 0; ch < channels; ch++) {
            const pos = dataStart + (i * channels + ch) * 2
            if (pos + 2 <= buffer.length) sum += buffer.readInt16BE(pos) / 32768
          }
          monoSamples[i] = sum / channels
        }
      } else if (bitsPerSample === 24) {
        for (let i = 0; i < totalSamples; i++) {
          let sum = 0
          for (let ch = 0; ch < channels; ch++) {
            const pos = dataStart + (i * channels + ch) * 3
            if (pos + 3 <= buffer.length) {
              const val = (buffer[pos] << 16) | (buffer[pos + 1] << 8) | buffer[pos + 2]
              const signed = val > 0x7fffff ? val - 0x1000000 : val
              sum += signed / 8388608
            }
          }
          monoSamples[i] = sum / channels
        }
      } else if (bitsPerSample === 32) {
        for (let i = 0; i < totalSamples; i++) {
          let sum = 0
          for (let ch = 0; ch < channels; ch++) {
            const pos = dataStart + (i * channels + ch) * 4
            if (pos + 4 <= buffer.length) sum += buffer.readInt32BE(pos) / 2147483648
          }
          monoSamples[i] = sum / channels
        }
      } else {
        return null
      }

      return { samples: monoSamples, sampleRate }
    }

    offset += 8 + chunkSize
    if (chunkSize % 2 !== 0) offset++
  }

  return null
}

// ============================================================
// ffmpeg Fallback (MP3, FLAC, OGG, etc.)
// ============================================================

function decodeWithFfmpeg(filePath: string): PcmData | null {
  try {
    // Decode to raw 16-bit mono PCM at 44100Hz via ffmpeg
    const rawBuffer = execFileSync('ffmpeg', [
      '-i', filePath,
      '-f', 's16le',
      '-ac', '1',
      '-ar', '44100',
      '-v', 'quiet',
      '-'
    ], { maxBuffer: 100 * 1024 * 1024, timeout: 30000 })

    if (rawBuffer.length < 4) return null

    const samples = new Float32Array(rawBuffer.length / 2)
    for (let i = 0; i < samples.length; i++) {
      samples[i] = rawBuffer.readInt16LE(i * 2) / 32768
    }
    return { samples, sampleRate: 44100 }
  } catch {
    // ffmpeg not installed or conversion failed — skip analysis for this format
    return null
  }
}

// ============================================================
// FFT (radix-2 Cooley-Tukey, in-place)
// ============================================================

function fft(real: Float64Array, imag: Float64Array): void {
  const N = real.length
  // Bit-reversal permutation
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1
    for (; j & bit; bit >>= 1) {
      j ^= bit
    }
    j ^= bit
    if (i < j) {
      let tmp = real[i]; real[i] = real[j]; real[j] = tmp
      tmp = imag[i]; imag[i] = imag[j]; imag[j] = tmp
    }
  }
  // Butterfly stages
  for (let len = 2; len <= N; len <<= 1) {
    const halfLen = len >> 1
    const angle = -2 * Math.PI / len
    const wR = Math.cos(angle)
    const wI = Math.sin(angle)
    for (let i = 0; i < N; i += len) {
      let curR = 1, curI = 0
      for (let j = 0; j < halfLen; j++) {
        const a = i + j
        const b = a + halfLen
        const tR = curR * real[b] - curI * imag[b]
        const tI = curR * imag[b] + curI * real[b]
        real[b] = real[a] - tR
        imag[b] = imag[a] - tI
        real[a] += tR
        imag[a] += tI
        const nextR = curR * wR - curI * wI
        curI = curR * wI + curI * wR
        curR = nextR
      }
    }
  }
}

// Compute magnitude spectrum from PCM frame
function computeMagnitudes(frame: Float32Array, fftSize: number): Float64Array {
  const real = new Float64Array(fftSize)
  const imag = new Float64Array(fftSize)
  // Apply Hann window and copy
  for (let i = 0; i < frame.length && i < fftSize; i++) {
    const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / (frame.length - 1)))
    real[i] = frame[i] * w
  }
  fft(real, imag)
  const halfN = fftSize >> 1
  const magnitudes = new Float64Array(halfN)
  for (let i = 0; i < halfN; i++) {
    magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i])
  }
  return magnitudes
}

// ============================================================
// Spectral Features (centroid, flatness, ZCR)
// ============================================================

function spectralCentroid(magnitudes: Float64Array, sampleRate: number, fftSize: number): number {
  let weightedSum = 0, totalMag = 0
  for (let i = 1; i < magnitudes.length; i++) {
    const freq = (i * sampleRate) / fftSize
    weightedSum += freq * magnitudes[i]
    totalMag += magnitudes[i]
  }
  return totalMag > 0 ? weightedSum / totalMag : 0
}

function spectralFlatness(magnitudes: Float64Array): number {
  let logSum = 0, arithmeticSum = 0, count = 0
  for (let i = 1; i < magnitudes.length; i++) {
    if (magnitudes[i] > 1e-10) {
      logSum += Math.log(magnitudes[i])
      arithmeticSum += magnitudes[i]
      count++
    }
  }
  if (count === 0 || arithmeticSum === 0) return 0
  const geometricMean = Math.exp(logSum / count)
  const arithmeticMean = arithmeticSum / count
  return geometricMean / arithmeticMean
}

function zeroCrossingRate(samples: Float32Array): number {
  let crossings = 0
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) crossings++
  }
  return crossings / samples.length
}

function attackTimeMs(samples: Float32Array, sampleRate: number): number {
  // RMS in 1ms windows — find peak RMS and time to reach it
  const windowSamples = Math.max(1, Math.floor(sampleRate * 0.001))
  let maxRms = 0, maxIdx = 0
  for (let i = 0; i < samples.length - windowSamples; i += windowSamples) {
    let sum = 0
    const end = Math.min(i + windowSamples, samples.length)
    for (let j = i; j < end; j++) sum += samples[j] * samples[j]
    const rms = Math.sqrt(sum / (end - i))
    if (rms > maxRms) { maxRms = rms; maxIdx = i }
  }
  return (maxIdx / sampleRate) * 1000
}

function countOnsets(samples: Float32Array, sampleRate: number): number {
  // Simple energy-based onset detection
  const hopSize = Math.floor(sampleRate * 0.01) // 10ms hops
  const energies: number[] = []
  for (let i = 0; i < samples.length; i += hopSize) {
    let e = 0
    const end = Math.min(i + hopSize, samples.length)
    for (let j = i; j < end; j++) e += samples[j] * samples[j]
    energies.push(e / (end - i))
  }
  // Count peaks above threshold
  const maxE = Math.max(...energies)
  if (maxE === 0) return 0
  const threshold = maxE * 0.15
  let onsets = 0, wasBelow = true
  for (const e of energies) {
    if (e > threshold && wasBelow) { onsets++; wasBelow = false }
    if (e < threshold * 0.5) wasBelow = true
  }
  return onsets
}

// ============================================================
// MFCC Extraction
// ============================================================

function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700)
}

function melToHz(mel: number): number {
  return 700 * (Math.pow(10, mel / 2595) - 1)
}

function createMelFilterbank(numFilters: number, fftSize: number, sampleRate: number): Float64Array[] {
  const halfN = fftSize >> 1
  const melMin = hzToMel(0)
  const melMax = hzToMel(sampleRate / 2)
  const melPoints = new Float64Array(numFilters + 2)
  for (let i = 0; i < numFilters + 2; i++) {
    melPoints[i] = melMin + (i * (melMax - melMin)) / (numFilters + 1)
  }
  const binPoints = new Int32Array(numFilters + 2)
  for (let i = 0; i < numFilters + 2; i++) {
    binPoints[i] = Math.floor((fftSize + 1) * melToHz(melPoints[i]) / sampleRate)
  }

  const filters: Float64Array[] = []
  for (let m = 0; m < numFilters; m++) {
    const filter = new Float64Array(halfN)
    for (let k = binPoints[m]; k < binPoints[m + 1] && k < halfN; k++) {
      const denom = binPoints[m + 1] - binPoints[m]
      filter[k] = denom > 0 ? (k - binPoints[m]) / denom : 0
    }
    for (let k = binPoints[m + 1]; k < binPoints[m + 2] && k < halfN; k++) {
      const denom = binPoints[m + 2] - binPoints[m + 1]
      filter[k] = denom > 0 ? (binPoints[m + 2] - k) / denom : 0
    }
    filters.push(filter)
  }
  return filters
}

function computeMfccs(magnitudes: Float64Array, filterbank: Float64Array[], numCoeffs: number = 13): Float64Array {
  const numFilters = filterbank.length
  const logMelEnergies = new Float64Array(numFilters)
  for (let m = 0; m < numFilters; m++) {
    let energy = 0
    for (let k = 0; k < magnitudes.length; k++) {
      energy += magnitudes[k] * filterbank[m][k]
    }
    logMelEnergies[m] = Math.log(Math.max(energy, 1e-10))
  }

  const mfccs = new Float64Array(numCoeffs)
  for (let n = 0; n < numCoeffs; n++) {
    let sum = 0
    for (let m = 0; m < numFilters; m++) {
      sum += logMelEnergies[m] * Math.cos(Math.PI * n * (m + 0.5) / numFilters)
    }
    mfccs[n] = sum
  }
  return mfccs
}

// ============================================================
// Audio Embedding (spectral features + MFCCs averaged over STFT frames)
// ============================================================

function computeEmbedding(pcmSamples: Float32Array, sampleRate: number): number[] {
  const fftSize = 2048
  const hopSize = 1024
  const maxSamples = Math.min(pcmSamples.length, Math.floor(sampleRate * 30))
  const audio = pcmSamples.subarray(0, maxSamples)
  const numFrames = Math.floor((audio.length - fftSize) / hopSize)
  if (numFrames < 1) return []

  const filterbank = createMelFilterbank(26, fftSize, sampleRate)

  let centroidSum = 0, flatnessSum = 0, zcrSum = 0
  const mfccSums = new Float64Array(13)

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize
    const frame = audio.subarray(start, start + fftSize)
    const paddedFrame = new Float32Array(fftSize)
    paddedFrame.set(frame)
    const mags = computeMagnitudes(paddedFrame, fftSize)

    centroidSum += spectralCentroid(mags, sampleRate, fftSize)
    flatnessSum += spectralFlatness(mags)

    const frameSlice = audio.subarray(start, Math.min(start + fftSize, audio.length))
    zcrSum += zeroCrossingRate(frameSlice)

    const mfccs = computeMfccs(mags, filterbank, 13)
    for (let i = 0; i < 13; i++) mfccSums[i] += mfccs[i]
  }

  const embedding: number[] = [
    centroidSum / numFrames,
    flatnessSum / numFrames,
    zcrSum / numFrames
  ]
  for (let i = 0; i < 13; i++) {
    embedding.push(mfccSums[i] / numFrames)
  }
  return embedding
}

// ============================================================
// Waveform Hash (DJB2 on quantized peaks)
// ============================================================

function hashWaveformPeaks(peaks: number[]): string {
  let hash = 5381
  for (const p of peaks) {
    const q = Math.round(p * 100)
    hash = ((hash << 5) + hash + q) & 0xffffffff
  }
  return (hash >>> 0).toString(16)
}

// ============================================================
// BPM Detection (Spectral Flux + Autocorrelation)
// ============================================================

interface BpmResult { bpm: number | null; confidence: number | null }

function detectBpm(samples: Float32Array, sampleRate: number): BpmResult {
  // Downsample to ~11025 Hz for analysis
  const targetRate = 11025
  const ratio = Math.max(1, Math.floor(sampleRate / targetRate))
  const dsLen = Math.floor(samples.length / ratio)
  const downsampled = new Float32Array(dsLen)
  for (let i = 0; i < dsLen; i++) {
    downsampled[i] = samples[i * ratio]
  }
  const effectiveRate = sampleRate / ratio

  // Compute spectral flux onset detection function via STFT
  const fftSize = 1024
  const hopSize = 512
  const halfFFT = fftSize >> 1
  const numFrames = Math.floor((downsampled.length - fftSize) / hopSize)
  if (numFrames < 4) return null

  const onset = new Float32Array(numFrames)
  let prevMags: Float64Array | null = null

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize
    const frame = downsampled.subarray(start, start + fftSize)
    const mags = computeMagnitudes(frame, fftSize)

    if (prevMags) {
      let flux = 0
      for (let i = 0; i < halfFFT; i++) {
        const diff = mags[i] - prevMags[i]
        if (diff > 0) flux += diff
      }
      onset[f] = flux
    }
    prevMags = mags
  }

  // Autocorrelation on onset function
  const odfRate = effectiveRate / hopSize // frames per second
  const minBpm = 60
  const maxBpm = 200
  const minLag = Math.floor((odfRate * 60) / maxBpm)
  const maxLag = Math.min(Math.floor((odfRate * 60) / minBpm), onset.length - 1)
  const windowSize = Math.min(onset.length, Math.floor(odfRate * 10))

  let bestLag = 0
  let bestCorr = 0

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0, count = 0
    for (let i = 0; i < windowSize - lag; i++) {
      corr += onset[i] * onset[i + lag]
      count++
    }
    if (count > 0) corr /= count
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag }
  }

  if (bestLag === 0 || bestCorr < 0.0001) return { bpm: null, confidence: null }

  // Compute confidence: bestCorr normalized against zero-lag autocorrelation
  let zeroLagCorr = 0
  for (let i = 0; i < windowSize; i++) {
    zeroLagCorr += onset[i] * onset[i]
  }
  zeroLagCorr /= windowSize
  const bpmConfidence = zeroLagCorr > 0 ? Math.min(bestCorr / zeroLagCorr, 1.0) : 0

  let bpm = (odfRate * 60) / bestLag

  // Half/double time correction — clamp to 70-170 range
  if (bpm > 170) {
    // Check if half-tempo has decent correlation
    const halfLag = bestLag * 2
    if (halfLag <= maxLag) {
      let halfCorr = 0, count = 0
      for (let i = 0; i < windowSize - halfLag; i++) {
        halfCorr += onset[i] * onset[i + halfLag]
        count++
      }
      if (count > 0) halfCorr /= count
      if (halfCorr > bestCorr * 0.5) bpm /= 2
    } else {
      bpm /= 2
    }
  } else if (bpm < 70) {
    // Check if double-tempo has decent correlation
    const doubleLag = Math.floor(bestLag / 2)
    if (doubleLag >= minLag) {
      let dblCorr = 0, count = 0
      for (let i = 0; i < windowSize - doubleLag; i++) {
        dblCorr += onset[i] * onset[i + doubleLag]
        count++
      }
      if (count > 0) dblCorr /= count
      if (dblCorr > bestCorr * 0.5) bpm *= 2
    } else {
      bpm *= 2
    }
  }

  return { bpm: Math.round(bpm), confidence: Math.round(bpmConfidence * 100) / 100 }
}

// ============================================================
// Key Detection (STFT Chroma + Temperley Profiles)
// ============================================================

// Temperley profiles — better for modern/electronic music than Krumhansl-Schmuckler
const MAJOR_PROFILE = [5.0, 2.0, 3.5, 2.0, 4.5, 4.0, 2.0, 4.5, 2.0, 3.5, 1.5, 4.0]
const MINOR_PROFILE = [5.0, 2.0, 3.5, 4.5, 2.0, 4.0, 2.0, 4.5, 3.5, 2.0, 1.5, 4.0]
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

interface KeyResult { key: string | null; confidence: number | null }

function detectKey(samples: Float32Array, sampleRate: number): KeyResult {
  // Use up to 30s of audio
  const maxSamples = Math.min(samples.length, Math.floor(sampleRate * 30))
  const audio = samples.subarray(0, maxSamples)

  const fftSize = 4096
  const hopSize = 2048
  const numFrames = Math.floor((audio.length - fftSize) / hopSize)
  if (numFrames < 1) return null

  // Accumulate chroma across all STFT frames
  const chroma = new Float64Array(12)

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize
    const frame = audio.subarray(start, start + fftSize)
    const mags = computeMagnitudes(frame, fftSize)

    // Map frequency bins to pitch classes
    for (let bin = 1; bin < mags.length; bin++) {
      const freq = (bin * sampleRate) / fftSize
      if (freq < 60 || freq > 5000) continue // Relevant range for key detection
      // Convert frequency to MIDI note, then to pitch class
      const midi = 12 * Math.log2(freq / 440) + 69
      const pitchClass = Math.round(midi) % 12
      const pc = ((pitchClass % 12) + 12) % 12
      chroma[pc] += mags[bin]
    }
  }

  // Normalize chroma
  let maxChroma = 0
  for (let i = 0; i < 12; i++) {
    if (chroma[i] > maxChroma) maxChroma = chroma[i]
  }
  if (maxChroma === 0) return { key: null, confidence: null }
  for (let i = 0; i < 12; i++) {
    chroma[i] /= maxChroma
  }

  // Match against Temperley profiles for all keys
  let bestKey = ''
  let bestCorrelation = -Infinity

  for (let root = 0; root < 12; root++) {
    const rotated = new Float64Array(12)
    for (let i = 0; i < 12; i++) {
      rotated[i] = chroma[(i + root) % 12]
    }

    const majorCorr = pearsonCorrelation(rotated, MAJOR_PROFILE)
    if (majorCorr > bestCorrelation) {
      bestCorrelation = majorCorr
      bestKey = `${NOTE_NAMES[root]} maj`
    }

    const minorCorr = pearsonCorrelation(rotated, MINOR_PROFILE)
    if (minorCorr > bestCorrelation) {
      bestCorrelation = minorCorr
      bestKey = `${NOTE_NAMES[root]} min`
    }
  }

  if (bestCorrelation < 0.3) return { key: null, confidence: null }
  return { key: bestKey, confidence: Math.round(bestCorrelation * 100) / 100 }
}

function pearsonCorrelation(x: Float64Array, y: number[]): number {
  const n = x.length
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0
  for (let i = 0; i < n; i++) {
    sumX += x[i]
    sumY += y[i]
    sumXY += x[i] * y[i]
    sumX2 += x[i] * x[i]
    sumY2 += y[i] * y[i]
  }
  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  if (denom === 0) return 0
  return (n * sumXY - sumX * sumY) / denom
}

// ============================================================
// Waveform Peak Generation
// ============================================================

function generatePeaks(samples: Float32Array, numPeaks: number = 400): number[] {
  const totalSamples = samples.length
  const samplesPerPeak = Math.floor(totalSamples / numPeaks)
  if (samplesPerPeak === 0) return Array(numPeaks).fill(0)

  const peaks: number[] = []
  let maxPeak = 0

  for (let i = 0; i < numPeaks; i++) {
    const start = i * samplesPerPeak
    const end = Math.min(start + samplesPerPeak, totalSamples)
    let peak = 0

    for (let j = start; j < end; j++) {
      const abs = Math.abs(samples[j])
      if (abs > peak) peak = abs
    }

    peaks.push(peak)
    if (peak > maxPeak) maxPeak = peak
  }

  if (maxPeak > 0) {
    for (let i = 0; i < peaks.length; i++) {
      peaks[i] = peaks[i] / maxPeak
    }
  }

  return peaks
}

// ============================================================
// Audio-based Category Refinement (spectral features + decision tree)
// ============================================================

function categorizeBySample(
  samples: Float32Array,
  sampleRate: number,
  currentCategory: string
): string {
  if (currentCategory !== 'other') return currentCategory

  const durationMs = (samples.length / sampleRate) * 1000
  const onsets = countOnsets(samples, sampleRate)
  const attack = attackTimeMs(samples, sampleRate)

  // Compute spectral features from a representative frame
  const fftSize = 2048
  const analysisLen = Math.min(samples.length, fftSize)
  const frame = samples.subarray(0, analysisLen)
  const paddedFrame = new Float32Array(fftSize)
  paddedFrame.set(frame)
  const mags = computeMagnitudes(paddedFrame, fftSize)
  const centroid = spectralCentroid(mags, sampleRate, fftSize)
  const flatness = spectralFlatness(mags)
  const zcr = zeroCrossingRate(samples)

  // Decision tree based on research (Sononym/XO approach)
  if (durationMs > 2000 && onsets > 4) return 'loop'
  if (durationMs > 3000 && attack > 50 && flatness < 0.2) return 'pad'

  if (durationMs < 2000) {
    if (centroid < 500 && flatness < 0.1) {
      return durationMs > 300 ? 'bass' : 'kick'
    }
    if (centroid > 1000 && centroid < 4000 && flatness > 0.15 && flatness < 0.4) {
      return 'snare'
    }
    if (centroid > 5000 && flatness > 0.3) {
      return 'hi-hat'
    }
    if (centroid > 200 && centroid < 1000 && flatness < 0.15 && attack < 10) {
      return 'percussion'
    }
  }

  // Fallback heuristics
  if (durationMs < 300 && attack < 5) return 'one-shot'
  if (durationMs > 3000) return 'loop'
  if (durationMs > 1500 && zcr < 0.05) return 'pad'

  return 'other'
}

// ============================================================
// Metadata Extraction (music-metadata)
// ============================================================

async function extractMetadata(filePath: string): Promise<{
  duration_ms: number | null
  sample_rate: number | null
  channels: number | null
  bit_depth: number | null
}> {
  try {
    const mm = await import('music-metadata')
    const metadata = await mm.parseFile(filePath, { duration: true })
    return {
      duration_ms: metadata.format.duration ? Math.round(metadata.format.duration * 1000) : null,
      sample_rate: metadata.format.sampleRate ?? null,
      channels: metadata.format.numberOfChannels ?? null,
      bit_depth: metadata.format.bitsPerSample ?? null
    }
  } catch (err) {
    console.error(`[Worker] Failed to extract metadata from ${filePath}:`, err)
    return { duration_ms: null, sample_rate: null, channels: null, bit_depth: null }
  }
}

// ============================================================
// Piscina entry point — default export
// ============================================================

export default async function analyzeFile(args: {
  filePath: string
  currentCategory: string
}): Promise<AnalysisResultData> {
  const meta = await extractMetadata(args.filePath)
  const pcm = decodePcm(args.filePath)

  let bpm: number | null = null
  let bpmConf: number | null = null
  let musicalKey: string | null = null
  let keyConf: number | null = null
  let peaks: number[] = []
  let category = args.currentCategory
  let embedding: number[] = []
  let waveformHash: string | null = null
  let sCentroid: number | null = null
  let sFlatness: number | null = null
  let sZcr: number | null = null
  let sAttack: number | null = null
  let sOnsets: number | null = null

  if (pcm) {
    const bpmResult = detectBpm(pcm.samples, pcm.sampleRate)
    bpm = bpmResult.bpm
    bpmConf = bpmResult.confidence

    const keyResult = detectKey(pcm.samples, pcm.sampleRate)
    musicalKey = keyResult.key
    keyConf = keyResult.confidence

    peaks = generatePeaks(pcm.samples, 400)
    category = categorizeBySample(pcm.samples, pcm.sampleRate, category)

    // Compute embedding (16-dim: 3 spectral + 13 MFCCs)
    embedding = computeEmbedding(pcm.samples, pcm.sampleRate)

    // Waveform hash for duplicate detection
    waveformHash = hashWaveformPeaks(peaks)

    // Spectral features for NLP search filters
    const fftSize = 2048
    const analysisLen = Math.min(pcm.samples.length, fftSize)
    const frame = pcm.samples.subarray(0, analysisLen)
    const padded = new Float32Array(fftSize)
    padded.set(frame)
    const mags = computeMagnitudes(padded, fftSize)
    sCentroid = Math.round(spectralCentroid(mags, pcm.sampleRate, fftSize) * 100) / 100
    sFlatness = Math.round(spectralFlatness(mags) * 10000) / 10000
    sZcr = Math.round(zeroCrossingRate(pcm.samples) * 10000) / 10000
    sAttack = Math.round(attackTimeMs(pcm.samples, pcm.sampleRate) * 100) / 100
    sOnsets = countOnsets(pcm.samples, pcm.sampleRate)
  }

  return {
    duration_ms: meta.duration_ms,
    sample_rate: meta.sample_rate,
    channels: meta.channels,
    bit_depth: meta.bit_depth,
    bpm,
    bpm_confidence: bpmConf,
    musical_key: musicalKey,
    key_confidence: keyConf,
    category,
    waveform_peaks: peaks,
    waveform_hash: waveformHash,
    embedding,
    spectral_centroid: sCentroid,
    spectral_flatness: sFlatness,
    zero_crossing_rate: sZcr,
    attack_time_ms: sAttack,
    onset_count: sOnsets
  }
}
