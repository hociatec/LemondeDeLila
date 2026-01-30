import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceDir = path.join(
  root,
  'Étagère des Quatre Vents',
  'Sac à Malices!',
  ',Chouette et fortune !',
);
const targetDir = path.join(
  root,
  'backend',
  'src',
  'game',
  'games',
  'les-quatre-vents',
  'sac-a-malices',
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
  const start = raw.indexOf('\n1.');
  const text = start === -1 ? raw : raw.slice(start + 1);
  const regex = /(\d+)\.\s*([^\n]+)\n([\s\S]*?)(?=\n\d+\.|$)/g;
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
  const blocks = parseNumberedBlocks(raw);
  return blocks.map((b) => ({ id: b.id, text: `${b.title}. ${b.description}`.trim() }));
};

const normalize = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[’'`]/g, "'")
    .replace(/[^a-z0-9àâäçéèêëîïôöùûüÿñœ\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const inferTile = (n, title, description) => {
  const t = `${title} ${description}`.toLowerCase();
  if (n === 1 || t.includes('départ')) return { type: 'start' };
  if (t.includes('chance')) return { type: 'chance' };
  if (t.includes('caisse de communauté') || t.includes('caisse de communaute')) return { type: 'community' };
  if (t.includes('allez en prison')) return { type: 'go_to_jail' };
  if (t.includes('prison')) return { type: 'jail' };
  if (t.includes('parc gratuit')) return { type: 'free' };
  if (t.includes('taxe')) return { type: 'tax' };
  if (t.includes('gare')) return { type: 'station' };
  if (t.includes('compagnie')) return { type: 'utility' };
  const colorMatch = title.match(/\(([^)]+)\)/);
  if (colorMatch) return { type: 'property', group: colorMatch[1].trim() };
  return { type: 'neutral' };
};

const boardBlocks = parseNumberedBlocks(readText(path.join(sourceDir, 'Cases du plateau Dijonnais.txt')));
const tiles = boardBlocks.map((b) => {
  const inferred = inferTile(b.id, b.title, b.description);
  return {
    n: b.id,
    title: b.title,
    description: b.description,
    ...inferred,
  };
});

const groupsRaw = readText(path.join(sourceDir, 'Fiche groupes.txt'));
const groupSections = groupsRaw.split(/\n\s*\n+/).map((s) => s.trim()).filter(Boolean);
const groups = [];
for (const section of groupSections) {
  const title = section.match(/^Groupe\s+(.+)$/im)?.[1]?.trim();
  if (!title) continue;
  const propsLine = section.match(/Propri[eé]t[eé]s\s*:\s*([^\n]+)/i)?.[1]?.trim() ?? '';
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

const stationsRaw = readText(path.join(sourceDir, 'Fiche gares.txt'));
const stationsProps = stationsRaw.match(/Propri[eé]t[eé]s\s*:\s*([^\n]+)/i)?.[1] ?? '';
const stationNames = stationsProps.split(',').map((s) => s.trim()).filter(Boolean);
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

const utilitiesRaw = readText(path.join(sourceDir, 'Fiche compagnies.txt'));
const utilBlocks = utilitiesRaw.split(/\n\s*\n+/).map((s) => s.trim()).filter(Boolean);
const utilities = [];
for (const block of utilBlocks) {
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
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

const chanceCards = parseCards(readText(path.join(sourceDir, 'Cartes chance.txt')));
const communityCards = parseCards(readText(path.join(sourceDir, 'Cartes caisse de communauté.txt')));

// Matche des noms pour éviter les différences d’accents
const nameIndex = new Map();
tiles.forEach((t, idx) => {
  nameIndex.set(normalize(t.title.replace(/\([^)]*\)/g, '')), idx);
});

const out = (filename, data) =>
  fs.writeFileSync(path.join(targetDir, filename), JSON.stringify(data, null, 2), 'utf8');

out('board.json', { version: 1, tiles });
out('groups.json', { version: 1, groups });
out('stations.json', { version: 1, stations });
out('utilities.json', { version: 1, utilities });
out('chance-cards.json', { version: 1, cards: chanceCards });
out('community-cards.json', { version: 1, cards: communityCards });

console.log('Sac à Malices (Dijon) content generated.');

