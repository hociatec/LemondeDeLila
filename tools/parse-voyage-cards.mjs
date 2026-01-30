import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceDir = path.join(root, 'Étagère des Quatre Vents', 'Voyage En Terre De Brumes !');
const targetDir = path.join(
  root,
  'backend',
  'src',
  'game',
  'games',
  'les-quatre-vents',
  'voyage-en-terre-de-brumes',
  'model',
  'content',
);

fs.mkdirSync(targetDir, { recursive: true });

const parseCards = (filename) => {
  const data = fs.readFileSync(path.join(sourceDir, filename), 'utf8').replace(/\r/g, '');
  const start = data.indexOf('\n1.');
  const trimmed = start === -1 ? data : data.slice(start + 1);
  const regex = /(\d+)\.\s*(.+?)\n([\s\S]*?)(?=\n\d+\.|$)/g;
  const cards = [];
  let match;
  while ((match = regex.exec(trimmed))) {
    const id = Number(match[1]);
    const title = match[2].trim();
    const body = match[3].trim();
    const lines = body
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    const effectIndex = lines.findIndex((line) => /^effet/i.test(line));
    const descriptionLines = effectIndex >= 0 ? lines.slice(0, effectIndex) : lines;
    const effectLines = effectIndex >= 0 ? lines.slice(effectIndex) : [];
    cards.push({
      id,
      title,
      description: descriptionLines.join(' '),
      effect: effectLines
        .map((line) => line.replace(/^effet\s*:?/i, '').trim())
        .join(' '),
    });
  }
  return cards;
};

const deckFiles = [
  { filename: 'cartes légendes.txt', key: 'legend' },
  { filename: 'cartes farces.txt', key: 'farce' },
  // NB: le nom de fichier dans l'étagère contient "culpturels" (typo conservée)
  { filename: 'cartes trésors culpturels.txt', key: 'treasure' },
  { filename: 'cartes paysages.txt', key: 'landscape' },
];

for (const { filename, key } of deckFiles) {
  const cards = parseCards(filename);
  fs.writeFileSync(
    path.join(targetDir, `${key}-cards.json`),
    JSON.stringify({ version: 1, cards }, null, 2),
    'utf8',
  );
}

const boardRaw = fs
  .readFileSync(path.join(sourceDir, 'Plateau.txt'), 'utf8')
  .replace(/\r/g, '');
const boardStart = boardRaw.indexOf('\n1.');
const boardText = boardStart === -1 ? boardRaw : boardRaw.slice(boardStart + 1);
const boardRegex = /(\d+)\.\s*([^\n]+)\n([\s\S]*?)(?=\n\d+\.|$)/g;

const normalizeType = (text) => {
  const clean = String(text ?? '').toLowerCase();
  if (clean.includes('case départ')) return { type: 'start', label: 'Case départ' };
  if (clean.includes('case arriv')) return { type: 'finish', label: 'Case arrivée' };
  if (clean.includes('case repos')) return { type: 'rest', label: 'Case repos' };
  if (clean.includes('case passage') || clean.includes('passage')) return { type: 'passage', label: 'Passage' };
  if (clean.includes('tradition') || clean.includes('légende') || clean.includes('legende'))
    return { type: 'legend', label: 'Légende' };
  if (clean.includes('farce')) return { type: 'farce', label: 'Farce' };
  if (clean.includes('trésor') || clean.includes('tresor')) return { type: 'treasure', label: 'Trésor Culturel' };
  if (clean.includes('paysage')) return { type: 'landscape', label: 'Paysage' };
  return { type: 'neutral', label: 'Neutre' };
};

const tiles = [];
let match;
while ((match = boardRegex.exec(boardText))) {
  const id = Number(match[1]);
  const titleLine = match[2].trim();
  const desc = match[3].trim().replace(/\n+/g, ' ');
  const { type, label } = normalizeType(titleLine);
  tiles.push({
    id,
    title: titleLine,
    type,
    description: desc,
    label,
  });
}

fs.writeFileSync(
  path.join(targetDir, 'board.json'),
  JSON.stringify({ version: 1, tiles }, null, 2),
  'utf8',
);

console.log('Voyage content generated.');

