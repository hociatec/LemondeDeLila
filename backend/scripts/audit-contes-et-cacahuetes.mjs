import fs from 'node:fs';

const setupPath =
  'backend/src/game/games/les-quatre-vents/contes-et-cacahuetes/setup/contes-et-cacahuetes-setup.service.ts';
const actionsPath =
  'backend/src/game/games/les-quatre-vents/contes-et-cacahuetes/actions/contes-action.service.ts';

function extractDeckIds(source, type) {
  const re = new RegExp(`\\{\\s*id:\\s*(\\d+),\\s*type:\\s*'${type}'`, 'g');
  const ids = [];
  let m;
  while ((m = re.exec(source))) ids.push(Number(m[1]));
  return [...new Set(ids)].sort((a, b) => a - b);
}

function extractSwitchCaseIds(source, methodName) {
  const methodIdx = source.indexOf(`private ${methodName}(`);
  if (methodIdx < 0) return null;

  const slice = source.slice(methodIdx);
  const endIdx = slice.indexOf('\n  }', 0);
  const body = endIdx > 0 ? slice.slice(0, endIdx) : slice;

  const re = /\bcase\s+(\d+)\s*:/g;
  const ids = [];
  let m;
  while ((m = re.exec(body))) ids.push(Number(m[1]));
  return [...new Set(ids)].sort((a, b) => a - b);
}

function diff(expected, handled) {
  const handledSet = new Set(handled ?? []);
  return expected.filter((id) => !handledSet.has(id));
}

const setup = fs.readFileSync(setupPath, 'utf8');
const actions = fs.readFileSync(actionsPath, 'utf8');

const decks = {
  bonus: extractDeckIds(setup, 'bonus'),
  malus: extractDeckIds(setup, 'malus'),
  surprise: extractDeckIds(setup, 'surprise'),
  conte: extractDeckIds(setup, 'conte'),
};

const handled = {
  bonus: extractSwitchCaseIds(actions, 'applyBonusEffectById'),
  malus: extractSwitchCaseIds(actions, 'applyMalusEffectById'),
  surprise: extractSwitchCaseIds(actions, 'applySurpriseEffectById'),
};

const report = [
  {
    deck: 'bonus',
    expected: decks.bonus,
    handled: handled.bonus ?? [],
    missing: diff(decks.bonus, handled.bonus ?? []),
  },
  {
    deck: 'malus',
    expected: decks.malus,
    handled: handled.malus ?? [],
    missing: diff(decks.malus, handled.malus ?? []),
  },
  {
    deck: 'surprise',
    expected: decks.surprise,
    handled: handled.surprise ?? [],
    missing: diff(decks.surprise, handled.surprise ?? []),
  },
];

for (const r of report) {
  console.log(`\n[${r.deck}]`);
  console.log('expected:', r.expected.join(', ') || '(none)');
  console.log('handled :', r.handled.join(', ') || '(none)');
  console.log('missing :', r.missing.join(', ') || 'OK');
}

console.log('\n[conte]');
console.log('deck conte ids:', decks.conte.length ? `${decks.conte[0]}..${decks.conte.at(-1)} (${decks.conte.length})` : '(none)');
console.log('handled conte:', 'OK (cartes conte affichées, sans effet spécifique)');

