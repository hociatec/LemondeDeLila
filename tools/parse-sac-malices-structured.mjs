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
const chanceFile = arg('--chance');
const communityFile = arg('--community');
const groupsFile = arg('--groups');
const stationsFile = arg('--stations');
const utilitiesFile = arg('--utilities');

if (!variant || !gameType) {
  throw new Error(
    'Usage: node tools/parse-sac-malices-structured.mjs --variant \",Sabord et Quai\" --gameType sac-a-malices-sabord-et-quai --board \"Cases ...txt\" --chance \"Cartes ...txt\" --community \"Cartes ...txt\" --groups \"Fiches ...txt\" --stations \"Fiche(s) ...txt\" --utilities \"Fiche(s) ...txt\"',
  );
}
for (const [label, v] of [
  ['--board', boardFile],
  ['--chance', chanceFile],
  ['--community', communityFile],
  ['--groups', groupsFile],
  ['--stations', stationsFile],
  ['--utilities', utilitiesFile],
]) {
  if (!v) throw new Error(`${label} requis`);
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

const parseNumberedBlocks = (raw) => {
  const text = String(raw ?? '');
  const regex = /(?:^|\n)\s*(\d+)\.\s*([^\n]+)\n([\s\S]*?)(?=\n\s*\d+\.|$)/g;
  const items = [];
  let m;
  while ((m = regex.exec(text))) {
    const id = Number(m[1]);
    const title = m[2].trim().replace(/:$/, '').trim();
    const desc = m[3].trim().replace(/\n+/g, ' ').trim();
    items.push({ id, title, description: desc });
  }
  return items;
};

const parseCards = (raw) => {
  const lines = String(raw ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trimEnd());

  const items = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(/^(\d+)\.\s*(.+)$/);
    if (m) {
      if (current) items.push(current);
      current = { id: Number(m[1]), text: String(m[2]).trim() };
      continue;
    }
    if (current && line.trim()) {
      current.text = `${current.text} ${line.trim()}`.trim();
    }
  }
  if (current) items.push(current);
  return items.filter((c) => Number.isFinite(c.id) && c.text);
};

const inferTile = (n, title, description) => {
  const tTitle = String(title ?? '').toLowerCase();
  const tAll = `${title} ${description}`.toLowerCase();

  if (n === 1 || tTitle.includes('départ')) return { type: 'start' };
  if (tAll.includes('allez en prison')) return { type: 'go_to_jail' };
  if (tTitle.includes('parc gratuit')) return { type: 'free' };
  if (tTitle.includes('taxe')) return { type: 'tax' };
  if (tTitle.includes('gare')) return { type: 'station' };
  if (tTitle.includes('compagnie')) return { type: 'utility' };

  const colorMatch = String(title ?? '').match(/\(([^)]+)\)/);
  if (colorMatch) return { type: 'property', group: colorMatch[1].trim() };

  if (tTitle.includes('chance')) return { type: 'chance' };
  if (
    tTitle.includes('caisse de communauté') ||
    tTitle.includes('caisse de communaute')
  )
    return { type: 'community' };
  if (tTitle.includes('prison')) return { type: 'jail' };

  return { type: 'neutral' };
};

const boardBlocks = parseNumberedBlocks(
  readText(path.join(sourceDir, boardFile)),
);
const tiles = boardBlocks.map((b) => {
  const inferred = inferTile(b.id, b.title, b.description);
  return {
    n: b.id,
    title: b.title,
    description: b.description,
    ...inferred,
  };
});

const groupsRaw = readText(path.join(sourceDir, groupsFile));
const groupSections = groupsRaw
  .split(/\n\s*\n+/)
  .map((s) => s.trim())
  .filter(Boolean);
const groups = [];
for (const section of groupSections) {
  const title = section.match(/^Groupe\s+(.+)$/im)?.[1]?.trim();
  if (!title) continue;
  const propsLine =
    section.match(/Propri[eé]t[eé]s\s*:\s*([^\n]+)/i)?.[1]?.trim() ?? '';
  const properties = propsLine
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const num = (re) => {
    const m = section.match(re);
    return m ? Number(m[1]) : 0;
  };
  const group = {
    color: title,
    properties,
    purchasePrice: num(/Prix d[’']achat\s*:\s*(\d+)/i),
    mortgage: num(/Hypoth[eè]que\s*:\s*(\d+)/i),
    unmortgageCost: num(/Co[uû]t pour lever l[’']hypoth[eè]que\s*:\s*(\d+)/i),
    rents: {
      base: num(/Loyer de base\s*:\s*(\d+)/i),
      house1: num(/Loyer avec 1 maison[^:]*:\s*(\d+)/i),
      house2: num(/Loyer avec 2 maisons[^:]*:\s*(\d+)/i),
      house3: num(/Loyer avec 3 maisons[^:]*:\s*(\d+)/i),
      house4: num(/Loyer avec 4 maisons[^:]*:\s*(\d+)/i),
      hotel: num(/Loyer avec h[ôo]tel[^:]*:\s*(\d+)/i),
    },
    housePrice: num(/Prix d[’']une maison[^:]*:\s*(\d+)/i),
    hotelPrice: num(/Prix d[’']un h[ôo]tel[^:]*:\s*(\d+)/i),
  };
  groups.push(group);
}

const stationsRaw = readText(path.join(sourceDir, stationsFile));
const stationsProps =
  stationsRaw.match(/Propri[eé]t[eé]s\s*:\s*([^\n]+)/i)?.[1] ?? '';
const stationNames = stationsProps
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const stationNums = (re) => {
  const m = stationsRaw.match(re);
  return m ? Number(m[1]) : 0;
};
const stations = {
  properties: stationNames,
  purchasePrice: stationNums(/Prix d[’']achat\s*:\s*(\d+)/i),
  mortgage: stationNums(/Hypoth[eè]que\s*:\s*(\d+)/i),
  unmortgageCost: stationNums(/Co[uû]t pour lever l[’']hypoth[eè]que\s*:\s*(\d+)/i),
  rents: {
    1: stationNums(/Loyer si 1 gare[^:]*:\s*(\d+)/i),
    2: stationNums(/Loyer si 2 gares[^:]*:\s*(\d+)/i),
    3: stationNums(/Loyer si 3 gares[^:]*:\s*(\d+)/i),
    4: stationNums(/Loyer si 4 gares[^:]*:\s*(\d+)/i),
  },
};

const utilitiesRaw = readText(path.join(sourceDir, utilitiesFile));
const utilBlocks = utilitiesRaw
  .split(/\n\s*\n+/)
  .map((s) => s.trim())
  .filter(Boolean);
const utilities = [];
for (const block of utilBlocks) {
  const lines = block
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const name = lines[0];
  if (!name || /^Fiches?\s+compagnies/i.test(name)) continue;
  const num = (re) => {
    const m = block.match(re);
    return m ? Number(m[1]) : 0;
  };
  const util = {
    name,
    purchasePrice: num(/Prix d[’']achat\s*:\s*(\d+)/i),
    mortgage: num(/Hypoth[eè]que\s*:\s*(\d+)/i),
    unmortgageCost: num(/Lev[ée]e d[’']hypoth[eè]que\s*:\s*(\d+)/i),
    multiplier1: num(/1 compagnie\s*:\s*(\d+)\s*[×x]/i) || 4,
    multiplier2: num(/2 compagnies\s*:\s*(\d+)\s*[×x]/i) || 10,
  };
  utilities.push(util);
}

const chanceCards = parseCards(readText(path.join(sourceDir, chanceFile)));
const communityCards = parseCards(readText(path.join(sourceDir, communityFile)));

const out = (filename, data) =>
  fs.writeFileSync(path.join(targetDir, filename), JSON.stringify(data, null, 2), 'utf8');

out('board.json', { version: 1, tiles });
out('groups.json', { version: 1, groups });
out('stations.json', { version: 1, stations });
out('utilities.json', { version: 1, utilities });
out('chance-cards.json', { version: 1, cards: chanceCards });
out('community-cards.json', { version: 1, cards: communityCards });

console.log(`Sac à Malices structured content generated for ${gameType}.`);

