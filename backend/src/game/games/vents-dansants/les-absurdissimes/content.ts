import {
  freezeGameContent,
  rejectContent,
} from '../../../core/application/public-api';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface AbsurdissimesCard {
  id: string;
  text: string;
}

export const WHITE_CARDS = loadCards('white-cards.txt').map((text, index) => ({
  id: `white-${index + 1}`,
  text,
}));
export const BLACK_CARDS = loadCards('black-cards.txt').map((text, index) => ({
  id: `black-${index + 1}`,
  text,
}));

function loadCards(fileName: string): string[] {
  const candidates = [
    resolve(__dirname, 'data', fileName),
    resolve(
      process.cwd(),
      'src/game/games/vents-dansants/les-absurdissimes/data',
      fileName,
    ),
    resolve(
      process.cwd(),
      'dist/game/games/vents-dansants/les-absurdissimes/data',
      fileName,
    ),
  ];
  const path = candidates.find(existsSync);
  if (!path) rejectContent(`Contenu Absurdissimes introuvable: ${fileName}`);
  const content = readFileSync(path, 'utf8');
  return [
    ...content.matchAll(/(?:^|\n)\d+\.\s*[\r\n]+([\s\S]*?)(?=\n\d+\.|$)/g),
  ]
    .map((match) =>
      (match[1] ?? '')
        .replace(/["\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}

freezeGameContent(WHITE_CARDS);
freezeGameContent(BLACK_CARDS);
