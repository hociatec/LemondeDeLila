import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// Read-only audit of the catalogue, fallback assets and public server files.
// Downloads go to a temporary directory, never to the application's sound cache.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');
const catalog = [...(await read('src/modules/audio/domain/SoundCatalog.cpp'))
  .matchAll(/SoundDescriptor\{SoundCue::(\w+), "(\w+)", SoundFamily::(\w+), (true|false)\}/g)]
  .map(([, id, key, family, loop]) => ({ id, key, family, loop: loop === 'true' }));
const fallbacks = [...(await read('src/modules/audio/infrastructure/LocalSoundManifest.cpp'))
  .matchAll(/L"([^"]+\.wav)"/g)].map((match) => match[1]);
const serverKeys = [...(await read('../backend/src/modules/sounds/application/read-models/sound-manifest.record.ts'))
  .split('] as const;')[0].matchAll(/'([^']+)'/g)].map((match) => match[1]);
const origin = process.env.LILA_AUDIO_AUDIT_ORIGIN || 'https://ws.lilas.hociatec.fr';
const output = process.argv[2];
if (!output) throw new Error('Usage: node scripts/audit-sounds.mjs <report.json>');
const temporary = path.join(os.tmpdir(), 'lila-audio-audit');
await mkdir(temporary, { recursive: true });
const probe = path.join(root, '../backend/node_modules/ffprobe-static/bin',
  process.platform, process.arch, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
async function fetchBytes(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}
function inspect(file) {
  const result = spawnSync(probe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file],
    { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (result.status !== 0) throw new Error(result.error?.message || result.stderr || 'ffprobe failed');
  const data = JSON.parse(result.stdout);
  const audio = data.streams.find((stream) => stream.codec_type === 'audio');
  if (!audio || !(Number(data.format.duration) > 0)) throw new Error(`No playable audio: ${file}`);
  return { codec: audio.codec_name, channels: audio.channels, sampleRate: audio.sample_rate,
    seconds: Number(data.format.duration) };
}
async function sourceFiles(directory) {
  const results = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) results.push(...await sourceFiles(file));
    else if (/\.(cpp|h)$/.test(item.name)) results.push(file);
  }
  return results;
}
const sources = await Promise.all((await sourceFiles(path.join(root, 'src')))
  .filter((file) => (!file.includes(`${path.sep}audio${path.sep}`) || file.endsWith('AudioService.cpp')) &&
    !file.includes(`${path.sep}admin${path.sep}`))
  .map(async (file) => ({ file: path.relative(root, file).replaceAll('\\', '/'), text: await readFile(file, 'utf8') })));
const manifest = JSON.parse(await fetchBytes(new URL('/api/sounds/manifest', origin)));
const report = { checkedAt: new Date().toISOString(), origin, manifestUpdatedAt: manifest.updatedAt,
  disabled: manifest.disabled, missingClientKeys: serverKeys.filter((key) => !catalog.some((cue) => cue.id === key)),
  sounds: [] };
const local = new Map();
for (const [index, cue] of catalog.entries()) {
  const entry = { ...cue, fallback: fallbacks[index], triggers: sources
    .filter((source) => source.text.includes(`SoundCue::${cue.id}`)).map((source) => source.file) };
  try {
    if (!local.has(entry.fallback)) local.set(entry.fallback, inspect(path.join(root, 'resources/sounds', entry.fallback)));
    entry.localAudio = local.get(entry.fallback);
    const remote = manifest.sounds[cue.id];
    if (remote) {
      const bytes = await fetchBytes(new URL(remote.url, origin));
      if (bytes.length !== remote.bytes || createHash('sha256').update(bytes).digest('hex') !== remote.sha256)
        throw new Error('Remote size/hash mismatch');
      const file = path.join(temporary, `${cue.id}-${remote.sha256}.wav`);
      await writeFile(file, bytes);
      entry.remoteAudio = inspect(file);
      entry.remoteBytes = bytes.length;
    }
  } catch (error) { entry.error = error.message; }
  report.sounds.push(entry);
  console.log(`${cue.id}: ${entry.error || (entry.remoteAudio ? 'local + remote OK' : 'local fallback only')}`);
}
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(`Report: ${output}; ${catalog.length} cues; ${local.size} local assets; ` +
  `${report.sounds.filter((cue) => cue.error).length} failures`);
if (report.sounds.some((cue) => cue.error) || report.missingClientKeys.length) process.exitCode = 1;
