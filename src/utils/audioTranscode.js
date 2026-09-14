import { spawn } from 'node:child_process'
import { logger } from './logger.js'

/**
 * Remuxes a WebM/Opus buffer — what Chrome/Edge/Firefox's MediaRecorder actually
 * produces for a voice recording — into an Ogg/Opus buffer. WhatsApp's Cloud API
 * rejects WebM outright for audio messages (error 131053, "Unsupported Audio mime
 * type"), accepting only audio/ogg;codecs=opus, audio/mpeg, audio/amr, audio/mp4,
 * audio/aac — never WebM, regardless of what magic-byte sniffing reports it as.
 *
 * Since the audio is already Opus-encoded, this is a pure container repackage
 * (`-c:a copy`, no re-encode, no quality loss, fast) via the system `ffmpeg`
 * binary — no new npm dependency for what's fundamentally a repackaging, not a
 * transcode. Returns null (never throws) if ffmpeg isn't installed or the remux
 * fails for any reason, so the caller can fall back to storing the original file
 * rather than breaking the whole upload.
 */
export function remuxWebmToOggOpus(inputBuffer) {
  return new Promise((resolve) => {
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    let ffmpeg
    try {
      ffmpeg = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-vn', '-c:a', 'copy', '-f', 'ogg', 'pipe:1'])
    } catch (err) {
      logger.warn({ err }, 'ffmpeg could not be spawned — voice message will be stored/sent in its original format')
      return finish(null)
    }

    const stdoutChunks = []
    let stderr = ''
    ffmpeg.stdout.on('data', (chunk) => stdoutChunks.push(chunk))
    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    ffmpeg.on('error', (err) => {
      // e.g. ENOENT — ffmpeg isn't installed on this server.
      logger.warn({ err }, 'ffmpeg is not available — voice message will be stored/sent in its original format')
      finish(null)
    })

    ffmpeg.on('close', (code) => {
      if (code !== 0 || stdoutChunks.length === 0) {
        logger.warn({ code, stderr }, 'ffmpeg remux to Ogg/Opus failed — voice message will be stored/sent in its original format')
        return finish(null)
      }
      finish(Buffer.concat(stdoutChunks))
    })

    // EPIPE if ffmpeg already exited (e.g. failed to spawn) — the 'error'/'close'
    // handlers above already cover reporting that; this only stops the write from
    // crashing the process with an unhandled 'error' event on the stream itself.
    ffmpeg.stdin.on('error', () => {})
    ffmpeg.stdin.write(inputBuffer)
    ffmpeg.stdin.end()
  })
}
