/* eslint-disable no-console */
// One-off migration:
// - Read backend/data/sounds/manifest.json
// - For every sound entry, transcode the stored file (.mp3 or .wav) to a stable PCM WAV
// - Recompute sha256/bytes/url to point at .wav
// - Remove stale .mp3/.wav files left behind

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ffmpegPath = require('ffmpeg-static');

const repoRoot = path.join(__dirname, '..', '..');
const dataRoot = path.join(repoRoot, 'backend', 'data', 'sounds');
const manifestPath = path.join(dataRoot, 'manifest.json');

function sha256File(filePath) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(filePath));
  return h.digest('hex');
}

function transcodeToStableWav(srcPath, outPath) {
  const args = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    srcPath,
    // Keep it predictable so hashing stays stable across platforms.
    '-ac',
    '2',
    '-ar',
    '44100',
    '-c:a',
    'pcm_s16le',
    outPath,
  ];

  const r = spawnSync(ffmpegPath, args, { stdio: 'inherit' });
  if (r.error) throw r.error;
  if (typeof r.status === 'number' && r.status !== 0) {
    throw new Error(`ffmpeg failed (code ${r.status}) for ${srcPath}`);
  }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function main() {
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    throw new Error(
      `ffmpeg-static not found. Expected ffmpeg path, got: ${String(ffmpegPath)}`,
    );
  }

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest.json not found at ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const sounds = manifest?.sounds || {};

  const transcodeCache = new Map(); // srcAbs -> { sha256, bytes }
  const processedOk = new Set(); // soundId that we successfully migrated
  let converted = 0;
  let reused = 0;
  let missing = 0;

  for (const soundId of Object.keys(sounds)) {
    const entry = sounds[soundId];
    if (!entry || !entry.sha256) continue;

    const soundDir = path.join(dataRoot, soundId);
    const srcWav = path.join(soundDir, `${entry.sha256}.wav`);
    const srcMp3 = path.join(soundDir, `${entry.sha256}.mp3`);
    let srcPath = fs.existsSync(srcWav)
      ? srcWav
      : fs.existsSync(srcMp3)
        ? srcMp3
        : null;

    if (!srcPath) {
      // Some older datasets may have an out-of-sync sha in the manifest.
      // Best-effort: if there is exactly one audio file in the directory, use it.
      if (fs.existsSync(soundDir)) {
        const candidates = fs
          .readdirSync(soundDir)
          .filter((f) => /\.(mp3|wav)$/i.test(f))
          .map((f) => path.join(soundDir, f))
          .filter((p) => fs.statSync(p).isFile());

        if (candidates.length === 1) {
          srcPath = candidates[0];
          console.warn(
            `[repair] ${soundId}: sha mismatch (manifest=${entry.sha256}), using ${path.basename(
              srcPath,
            )}`,
          );
        } else if (candidates.length > 1) {
          // Pick the newest file; warn so it can be reviewed.
          candidates.sort(
            (a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs,
          );
          srcPath = candidates[0];
          console.warn(
            `[repair] ${soundId}: sha mismatch (manifest=${entry.sha256}), picked newest ${path.basename(
              srcPath,
            )} among ${candidates.length} files`,
          );
        }
      }
    }

    if (!srcPath) {
      console.warn(`[missing] ${soundId}: no audio file found (sha=${entry.sha256})`);
      missing++;
      continue;
    }

    const srcAbs = path.resolve(srcPath);
    let out;
    if (transcodeCache.has(srcAbs)) {
      out = transcodeCache.get(srcAbs);
      reused++;
    } else {
      ensureDir(soundDir);
      const tmpOut = path.join(soundDir, `${soundId}.${process.pid}.tmp.wav`);
      transcodeToStableWav(srcAbs, tmpOut);

      const newSha = sha256File(tmpOut);
      const bytes = fs.statSync(tmpOut).size;
      const dest = path.join(soundDir, `${newSha}.wav`);

      if (!fs.existsSync(dest)) {
        fs.renameSync(tmpOut, dest);
      } else {
        // Another entry may have produced the same file.
        fs.unlinkSync(tmpOut);
      }

      out = { sha256: newSha, bytes };
      transcodeCache.set(srcAbs, out);
      converted++;
    }

    entry.soundId = soundId;
    entry.sha256 = out.sha256;
    entry.bytes = out.bytes;
    entry.url = `/api/sounds/${encodeURIComponent(soundId)}/${out.sha256}.wav`;
    processedOk.add(soundId);
  }

  // Cleanup: remove any mp3, and remove wav files that are not referenced by the manifest.
  const keepBySoundId = new Map();
  for (const soundId of Object.keys(sounds)) {
    const e = sounds[soundId];
    if (!e?.sha256) continue;
    keepBySoundId.set(soundId, new Set([`${e.sha256}.wav`]));
  }

  for (const soundId of Object.keys(sounds)) {
    const soundDir = path.join(dataRoot, soundId);
    const keep = keepBySoundId.get(soundId) || new Set();
    if (!fs.existsSync(soundDir)) continue;
    // If we couldn't confidently migrate this entry, don't delete anything in that folder.
    if (!processedOk.has(soundId)) {
      continue;
    }

    for (const f of fs.readdirSync(soundDir)) {
      const full = path.join(soundDir, f);
      if (!fs.statSync(full).isFile()) continue;

      const lower = f.toLowerCase();
      if (lower.endsWith('.mp3')) {
        fs.unlinkSync(full);
        continue;
      }
      if (lower.endsWith('.wav') && !keep.has(f)) {
        fs.unlinkSync(full);
      }
    }
  }

  manifest.updatedAt = new Date().toISOString();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log(
    JSON.stringify(
      {
        ok: true,
        converted,
        reused,
        missing,
        ffmpeg: ffmpegPath,
        manifest: manifestPath,
      },
      null,
      2,
    ),
  );
}

main();
