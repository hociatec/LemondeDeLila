'use strict';

const fs = require('node:fs');

const bcrypt = require('bcrypt');
const password = 'lemonde-de-lila-runtime-check';
const hash = bcrypt.hashSync(password, 4);
if (!bcrypt.compareSync(password, hash)) {
  throw new Error('bcrypt est chargé mais son binding natif ne fonctionne pas.');
}

const ffmpegPath = require('ffmpeg-static');
if (!ffmpegPath) {
  throw new Error("ffmpeg-static n'a retourné aucun exécutable.");
}
fs.accessSync(ffmpegPath, fs.constants.R_OK | fs.constants.X_OK);

const ffprobe = require('ffprobe-static');
if (!ffprobe?.path) {
  throw new Error("ffprobe-static n'a retourné aucun exécutable.");
}
fs.accessSync(ffprobe.path, fs.constants.R_OK | fs.constants.X_OK);

console.log('[verify:runtime-dependencies] bcrypt, ffmpeg et ffprobe opérationnels');
