import {
  freezeGameContent,
  rejectContent,
} from '../../../engine/sdk/public-api';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NawakChallenge } from './state';

export const NAWAK_CHALLENGES = loadChallenges();

function loadChallenges(): NawakChallenge[] {
  const candidates = [
    resolve(__dirname, 'data', 'nawak-defis.txt'),
    resolve(
      process.cwd(),
      'src/game/games/vents-dansants/nawak/data/nawak-defis.txt',
    ),
    resolve(
      process.cwd(),
      'dist/game/games/vents-dansants/nawak/data/nawak-defis.txt',
    ),
  ];
  const path = candidates.find(existsSync);
  if (!path) rejectContent('Contenu Nawak introuvable');
  return parseChallenges(readFileSync(path, 'utf8'));
}

function parseChallenges(content: string): NawakChallenge[] {
  const lines = content.split(/\r?\n/).map((line) => line.trim());
  const challenges: NawakChallenge[] = [];
  let index = 0;
  while (index < lines.length) {
    const header = lines[index]?.match(/^(\d+)\.$/);
    if (!header) {
      index += 1;
      continue;
    }
    const id = header[1];
    index += 1;
    const prompt: string[] = [];
    while (index < lines.length && !/^[123]\.$/.test(lines[index] ?? '')) {
      if (lines[index]) prompt.push(lines[index]);
      index += 1;
    }
    const answers: string[] = [];
    while (answers.length < 3 && index < lines.length) {
      if (!/^[123]\.$/.test(lines[index] ?? '')) break;
      index += 1;
      const parts: string[] = [];
      while (index < lines.length && !/^\d+\.$/.test(lines[index] ?? '')) {
        if (lines[index]) parts.push(lines[index]);
        index += 1;
      }
      answers.push(parts.join(' ').trim());
    }
    if (prompt.length > 0 && answers.length === 3) {
      challenges.push({
        id,
        prompt: prompt.join(' '),
        answers: [answers[0], answers[1], answers[2]],
      });
    }
  }
  if (challenges.length === 0) rejectContent('Aucun défi Nawak valide');
  return challenges;
}

freezeGameContent(NAWAK_CHALLENGES);
