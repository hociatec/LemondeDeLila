import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  assertSoundMime,
  readProbedSoundDuration,
} from './sounds-media-validation';
import { ffmpegPath, runAudioProcess } from './sounds-audio-process';
import {
  detectSoundSilence,
  probeSoundDurationSeconds,
  transcodeSoundToStableWav,
} from './sounds-audio.utils';

it.each([
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.wave', 'audio/x-wav'],
  ['.mp3', 'application/octet-stream'],
  ['.wav', undefined],
])(
  'accepts a compatible or unspecified MIME type: %s %s',
  (extension, mime) => {
    expect(() => assertSoundMime(extension!, mime)).not.toThrow();
  },
);

it.each([
  ['.wav', 'audio/mpeg'],
  ['.mp3', 'text/html'],
  ['.mp3', 'audio/wav'],
])('rejects an incompatible MIME type: %s %s', (extension, mime) => {
  expect(() => assertSoundMime(extension, mime)).toThrow('MIME');
});

it.each([
  'invalid JSON',
  '{}',
  JSON.stringify({
    format: { format_name: 'wav', duration: '2' },
    streams: [{ codec_type: 'video' }],
  }),
  JSON.stringify({
    format: { format_name: 'mp3', duration: '2' },
    streams: [{ codec_type: 'audio' }],
  }),
  JSON.stringify({
    format: { format_name: 'wav', duration: 'Infinity' },
    streams: [{ codec_type: 'audio' }],
  }),
])('rejects incomplete or inconsistent probe output: %s', (output) => {
  expect(() => readProbedSoundDuration(output, '.wav')).toThrow();
});

function audibleWav(): Buffer {
  const samples = 22_050;
  const bytes = Buffer.alloc(44 + samples * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(44_100, 24);
  bytes.writeUInt32LE(88_200, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index++) {
    bytes.writeInt16LE(
      Math.round(10_000 * Math.sin((index * 440 * Math.PI * 2) / 44_100)),
      44 + index * 2,
    );
  }
  return bytes;
}

it('validates real WAV/MP3 content and refuses renamed media and playlists', async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'lila-media-contract-'),
  );
  let encodedDirectory: string | undefined;
  const wav = path.join(directory, 'source.wav');
  const mp3 = path.join(directory, 'source.mp3');
  const renamed = path.join(directory, 'renamed.wav');
  const playlist = path.join(directory, 'playlist.wav');
  try {
    await fs.writeFile(wav, audibleWav());
    expect(await probeSoundDurationSeconds(wav, () => {})).toBeCloseTo(0.5);
    const converted = await runAudioProcess(ffmpegPath(), [
      '-y',
      '-i',
      wav,
      mp3,
    ]);
    expect(converted.code).toBe(0);
    expect(await probeSoundDurationSeconds(mp3, () => {})).toBeGreaterThan(0.4);
    await fs.copyFile(mp3, renamed);
    await expect(probeSoundDurationSeconds(renamed, () => {})).rejects.toThrow(
      'format audio annoncé',
    );
    await expect(
      probeSoundDurationSeconds(wav, () => {}, '.mp3'),
    ).rejects.toThrow('format audio annoncé');
    await fs.writeFile(playlist, "ffconcat version 1.0\nfile 'source.wav'\n");
    await expect(
      probeSoundDurationSeconds(playlist, () => {}),
    ).rejects.toThrow();
    const encoded = await transcodeSoundToStableWav(mp3, () => {});
    encodedDirectory = encoded.tempDir;
    expect(
      await probeSoundDurationSeconds(encoded.outputPath, () => {}),
    ).toBeGreaterThan(0.4);
    expect(await detectSoundSilence(encoded.outputPath)).toBe(false);
  } finally {
    if (encodedDirectory)
      await fs.rm(encodedDirectory, { recursive: true, force: true });
    await fs.rm(directory, { recursive: true, force: true });
  }
}, 30_000);
