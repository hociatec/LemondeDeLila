import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const arg = (name, fallback = null) => {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  const v = process.argv[idx + 1];
  return v == null ? fallback : String(v);
};

const variant = arg('--variant');
const gameType = arg('--gameType');
const boardFile = arg('--board');
const cardsFile = arg('--cards');
const profile = arg('--profile', 'cosmos');

if (!variant || !gameType || !boardFile || !cardsFile) {
  throw new Error(
    'Usage: node tools/parse-sac-malices-simple.mjs --variant \",Cosmos & Crédit\" --gameType sac-a-malices-cosmos-credit --board \"plateau.txt\" --cards \"cartes.txt\" --profile cosmos',
  );
}

const sourceDir = path.join(
  root,
  'Étagère des Quatre Vents (Jeux de plateaux)',
  'Sac à Malices ! (x7)',
  variant,
);
const targetDir = path.join(
  root,
  'backend',
  'src',
  'game',
  'games',
  'les-quatre-vents',
  gameType,
  'model',
  'content',
);
fs.mkdirSync(targetDir, { recursive: true });

const scoreText = (s) => {
  const str = String(s ?? '');
  const suspicious = (str.match(/[ÃÂâ€™â€œâ€]/g) ?? []).length;
  const replacement = (str.match(/\uFFFD/g) ?? []).length;
  return suspicious * 2 + replacement * 10;
};
const fix = (s) => {
  const raw = String(s ?? '');
  const c1 = raw;
  const c2 = Buffer.from(raw, 'latin1').toString('utf8');
  return scoreText(c2) < scoreText(c1) ? c2 : c1;
};
const readText = (p) => fix(fs.readFileSync(p, 'utf8')).replace(/\r/g, '');

const parsePlateau = (raw) => {
  const lines = String(raw ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trimEnd());

  const items = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\.\s*(.*)$/);
    if (m) {
      if (current) items.push(current);
      current = { n: Number(m[1]), title: String(m[2] ?? '').trim(), desc: [] };
      continue;
    }
    if (!current) continue;
    if (!line.trim()) continue;
    current.desc.push(line.trim());
  }
  if (current) items.push(current);

  const tiles = [];
  for (const it of items) {
    const n = it.n;
    let title = it.title;
    const descLines = [...(it.desc ?? [])];
    if (!title) {
      title = descLines.shift() ?? `Case ${n}`;
    }
    const description = descLines.join(' ').trim();
    const t = `${title} ${description}`.toLowerCase();

    let type = 'neutral';
    let group = undefined;

    if (n === 1 || t.includes('départ')) type = 'start';
    else if (t.includes('chance')) type = 'chance';
    else if (t.includes('communauté') || t.includes('evenement')) type = 'community';
    else if (t.includes('taxe')) type = 'tax';
    else if (t.includes('parking')) type = 'free';
    else if (t.includes('allez en prison')) type = 'go_to_jail';
    else if (t.includes('prison') || t.includes('trou noir')) type = 'jail';
    else if (
      (t.includes('gare') || t.includes('station')) &&
      (t.includes('propriété spéciale') || t.includes('propriete speciale'))
    )
      type = 'station';
    else type = 'property';

    // Grouping heuristic: 4 sides of the board (Monopoly-like)
    if (type === 'property') {
      if (n >= 2 && n <= 10) group = 'Groupe 1';
      else if (n >= 12 && n <= 20) group = 'Groupe 2';
      else if (n >= 22 && n <= 30) group = 'Groupe 3';
      else if (n >= 32 && n <= 40) group = 'Groupe 4';
      else group = 'Groupe 0';
    }

    tiles.push({ n, title, description, type, ...(group ? { group } : {}) });
  }
  return tiles;
};

const parseCardsSection = (raw, heading) => {
  const idx = raw.toLowerCase().indexOf(heading.toLowerCase());
  const slice = idx >= 0 ? raw.slice(idx) : raw;
  const lines = slice.split('\n').map((l) => l.trimEnd());

  const cards = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(/^(\d+)\.\s*$/);
    const m2 = line.match(/^(\d+)\.\s*(.+)$/);
    if (m2) {
      if (current) cards.push(current);
      current = { id: Number(m2[1]), text: String(m2[2]).trim() };
      continue;
    }
    if (m) {
      if (current) cards.push(current);
      current = { id: Number(m[1]), text: '' };
      continue;
    }
    if (current && line.trim()) {
      current.text = `${current.text} ${line.trim()}`.trim();
    }
  }
  if (current) cards.push(current);
  return cards.filter((c) => Number.isFinite(c.id) && c.text);
};

const tiles = parsePlateau(readText(path.join(sourceDir, boardFile)));
const rawCards = readText(path.join(sourceDir, cardsFile));

// Heuristics: if the file contains both decks, split by headings.
const hasCommunity = /communaut/i.test(rawCards);
const hasChance = /chance/i.test(rawCards) || /anomalie/i.test(rawCards);

const communityCards = hasCommunity
  ? parseCardsSection(rawCards, 'Communauté')
  : [];
const chanceCards = hasChance ? parseCardsSection(rawCards, 'Chance') : [];

const propertyNames = tiles
  .filter((t) => t.type === 'property')
  .map((t) => t.title);
const stationNames = tiles
  .filter((t) => t.type === 'station')
  .map((t) => t.title);

const uniq = (arr) => Array.from(new Set(arr));
const groups = uniq(
  tiles
    .filter((t) => t.type === 'property')
    .map((t) => t.group)
    .filter(Boolean),
).map((g, idx) => {
  const props = tiles
    .filter((t) => t.type === 'property' && t.group === g)
    .map((t) => t.title);

  // Generated economy: ascending tiers by group index
  const purchasePrice = 100 + idx * 60;
  const base = 10 + idx * 5;
  const spec =
    String(profile).toLowerCase() === 'gaia'
      ? { housePrices: { 1: 50, 2: 100, 3: 150, 4: 250 }, bonuses: [10, 20, 30, 50] }
      : { housePrices: { 1: 60, 2: 120, 3: 180, 4: 300 }, bonuses: [15, 30, 45, 75] };
  const housePrices = spec.housePrices;
  const bonuses = spec.bonuses;
  return {
    color: g,
    properties: props,
    purchasePrice,
    mortgage: Math.floor(purchasePrice / 2),
    unmortgageCost: Math.floor(purchasePrice / 2 * 1.1),
    rents: {
      base,
      house1: base + bonuses[0],
      house2: base + bonuses[0] + bonuses[1],
      house3: base + bonuses[0] + bonuses[1] + bonuses[2],
      house4: base + bonuses[0] + bonuses[1] + bonuses[2] + bonuses[3],
      hotel: 0,
    },
    housePrice: housePrices[1],
    hotelPrice: 0,
    housePrices: {
      1: housePrices[1],
      2: housePrices[2],
      3: housePrices[3],
      4: housePrices[4],
    },
  };
});

const stations = stationNames.length
  ? {
      properties: stationNames,
      purchasePrice: 200,
      mortgage: 100,
      unmortgageCost: 110,
      rents: { 1: 25, 2: 50, 3: 100, 4: 200 },
    }
  : {
      properties: [],
      purchasePrice: 0,
      mortgage: 0,
      unmortgageCost: 0,
      rents: { 1: 0, 2: 0, 3: 0, 4: 0 },
    };
const utilities = [];

const out = (filename, data) =>
  fs.writeFileSync(path.join(targetDir, filename), JSON.stringify(data, null, 2), 'utf8');

out('board.json', { version: 1, tiles });
out('groups.json', { version: 1, groups });
out('stations.json', { version: 1, stations });
out('utilities.json', { version: 1, utilities });
out('chance-cards.json', { version: 1, cards: chanceCards });
out('community-cards.json', { version: 1, cards: communityCards });

console.log(`Sac à Malices simple content generated for ${gameType}. (${propertyNames.length} propriétés)`);
