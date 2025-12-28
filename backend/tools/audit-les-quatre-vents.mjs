import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

function readText(filePath) {
  let s = fs.readFileSync(filePath, 'utf8');
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return s;
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function normalize(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function unique(items) {
  return [...new Set(items)];
}

function auditBoard({ game, boardPath, allowedTypes, requiredFieldsByType }) {
  const board = readJson(boardPath);
  const tiles = Array.isArray(board.tiles) ? board.tiles : [];

  const unknownType = tiles.filter((t) => !allowedTypes.includes(t?.type));

  const missingFields = [];
  for (const tile of tiles) {
    const req = requiredFieldsByType[tile?.type] ?? [];
    for (const field of req) {
      if (tile?.[field] == null) missingFields.push({ n: tile?.n, type: tile?.type, field });
    }
  }

  return {
    game,
    tilesTotal: tiles.length,
    tilesUnknownType: unknownType.map((t) => ({ n: t?.n, type: t?.type, title: t?.title })),
    tilesMissingFields: missingFields,
  };
}

function auditCards({ game, cardsPath, isHandled }) {
  const cards = readJson(cardsPath).cards ?? [];
  const list = Array.isArray(cards) ? cards : [];

  const unhandled = [];
  for (const card of list) {
    if (!isHandled(card)) {
      unhandled.push(card);
    }
  }

  return {
    game,
    cardsTotal: list.length,
    cardsUnhandled: unhandled.map((c) => ({
      id: c?.id,
      title: c?.title,
      category: c?.category,
      text: c?.text,
      lines: c?.lines,
    })),
  };
}

function minuitIsQuiz(card) {
  const lines = Array.isArray(card?.lines) ? card.lines : [];
  return lines.some((l) => /^[*]?[abc]\)/i.test(String(l).trim()));
}

function minuitIsHandled(card) {
  if (minuitIsQuiz(card)) return true;
  const text = Array.isArray(card?.lines) ? card.lines.join(' ') : '';
  const t = normalize(text);
  return (
    t.includes('echangez votre position avec un autre joueur') ||
    t.includes('vous offrez un cadeau a un autre joueur') ||
    t.includes('ignorez la prochaine case malus') ||
    (t.includes('ignorez la prochaine case') && t.includes('passe ton tour')) ||
    t.includes('les autres joueurs avancent de 1 case, sauf vous') ||
    t.includes('piochez a nouveau une carte au lieu de lancer le de') ||
    t.includes('case neutre la plus proche derriere') ||
    /passez (deux|trois) tours/.test(t) ||
    t.includes('passez votre tour') ||
    (t.includes('jusqu') && t.includes('prochaine carte noel')) ||
    (t.includes('jusqu') && t.includes('precedente carte noel')) ||
    t.includes('position avec le joueur juste derriere') ||
    t.includes('relancez immediatement le de') ||
    t.includes('relancez le de maintenant') ||
    t.includes('lancez le de et avancez du nombre obtenu') ||
    /avancez\s+de\s+([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+case/.test(t) ||
    /reculez\s+de\s+([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+case/.test(t)
  );
}

function frousseIsHandled(card) {
  const text = String(card?.text ?? '');
  const t = normalize(text);
  return (
    /echange(r|z) votre place/.test(t) ||
    t.includes('echangez immediatement vos places') ||
    t.includes('ignorez le prochain piege') ||
    t.includes('ignorez les pieges') ||
    t.includes('ignorez la prochaine carte fantome') ||
    /lancer un (\d) ou un (\d)/.test(t) ||
    (t.includes('obtenir un 6') && t.includes('jusqu')) ||
    /obtenez pas un (\d) ou plus/.test(t) ||
    t.includes('nombre pair') ||
    /n['’]avancerez que d['’]une seule case/i.test(text) ||
    t.includes('malus de moins 2') ||
    t.includes('malus de -2') ||
    t.includes('gardez le plus petit') ||
    t.includes('gardez le chiffre le plus bas') ||
    t.includes('doublez votre prochain lancer') ||
    t.includes('si vous faites un trois, reculez de 2 cases') ||
    t.includes('jusqu') && t.includes('case 40') ||
    (t.includes('relancez') && t.includes('de')) ||
    t.includes('laissant les autres joueurs filer de 3 cases') ||
    t.includes('si le resultat est impair, passez votre tour') ||
    /passez (deux|trois) tours/.test(t) ||
    t.includes('passez votre tour') ||
    t.includes('passez un tour') ||
    t.includes('retour a la case une') ||
    (t.includes('retournez') && t.includes('case une')) ||
    t.includes('allez en cuisine') ||
    /sautez\s+\d+\s+case/.test(t) ||
    /avancez[\s\S]*?(de|d['’])\s*([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+case/.test(t) ||
    /recul[\s\S]*?(de|d['’])\s*([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+case/.test(t) ||
    t.includes('rien ne vous arrive')
  );
}

function galoponsIsHandled(card) {
  const text = String(card?.text ?? '');
  const t = normalize(text);
  return (
    t.includes('rejouez') ||
    /recevez\s+\d+\s+jeton/.test(t) ||
    t.includes('recevez un jeton pomme') ||
    t.includes('gagnez 1 jeton pomme') ||
    t.includes('passez votre tour') ||
    t.includes('tous les joueurs restent sur place pendant un tour') ||
    t.includes('choisissez un joueur et avancez tout les deux') ||
    t.includes('donnez-lui une pomme') ||
    t.includes('donnez lui une pomme') ||
    t.includes('aidez un autre joueur') ||
    t.includes("defaussez-vous d''une pomme") ||
    t.includes("defaussez-vous d'une pomme") ||
    (t.includes('jusqu') && t.includes('prochaine case foret')) ||
    (t.includes('jusqu') && t.includes('prochaine case montagne')) ||
    /avancez\s+(de|d['’])\s*([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+case/.test(t) ||
    /reculez\s+(de|d['’])\s*([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+case/.test(t)
  );
}

function auditCaDerape() {
  const setupPath = path.join(ROOT, 'src/game/games/les-quatre-vents/ca-derape/setup/ca.setup.ts');
  const actionsPath = path.join(ROOT, 'src/game/games/les-quatre-vents/ca-derape/actions/ca-actions.service.ts');
  const setup = readText(setupPath);
  const countBlock = (name, itemPattern) => {
    const asConst = new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s+as\\s+const;`, 'm');
    const normal = new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\n\\s*\\];`, 'm');
    const body = (asConst.exec(setup)?.[1] ?? normal.exec(setup)?.[1] ?? '') + '';
    return (body.match(itemPattern) ?? []).length;
  };

  const simpleCount = countBlock('simple', /^\s*\[/gm);
  const spectacularCount = countBlock('spectacular', /^\s*\[/gm);
  const lossesCount = countBlock('losses', /^\s*\[/gm);
  const specialCount = countBlock('special', /^\s*\[/gm);
  const sharedCount = countBlock('shared', /^\s*\[/gm);
  const conditionalCount = countBlock('conditional', /^\s*['"]/gm);
  const rulesCount = countBlock('rules', /^\s*['"]/gm);
  const ambienceCount = countBlock('ambience', /^\s*['"]/gm);

  const cardsTotal = simpleCount + spectacularCount + lossesCount + specialCount + sharedCount + conditionalCount + rulesCount + ambienceCount;
  const ids = Array.from({ length: cardsTotal }, (_, i) => i + 1);

  const actions = readText(actionsPath);
  const referenced = [...actions.matchAll(/card\.id\s*===\s*(\d+)/g)].map((m) => Number(m[1]));
  const referencedIds = unique(referenced).sort((a, b) => a - b);
  const missing = referencedIds.filter((id) => !ids.includes(id));

  return {
    game: 'ca-derape',
    cardsTotal,
    cardsExpected: 80,
    breakdown: {
      simple: simpleCount,
      spectacular: spectacularCount,
      losses: lossesCount,
      special: specialCount,
      chaos: sharedCount,
      conditional: conditionalCount,
      rules: rulesCount,
      ambience: ambienceCount,
    },
    referencedIds,
    referencedMissingInDeck: missing,
  };
}

function auditOdyssee() {
  const setupPath = path.join(ROOT, 'src/game/games/les-quatre-vents/odyssee-quatre-cieux/setup/odyssee-setup.service.ts');
  const setup = readText(setupPath);
  const trackLength = /const\s+trackLength\s*=\s*(\d+)/.exec(setup)?.[1];
  const homeLength = /const\s+homeLength\s*=\s*(\d+)/.exec(setup)?.[1];
  return {
    game: 'odyssee-quatre-cieux',
    trackLength: trackLength ? Number(trackLength) : null,
    homeLength: homeLength ? Number(homeLength) : null,
  };
}

function main() {
  const reports = [];

  reports.push(
    auditBoard({
      game: 'en-attendant-minuit',
      boardPath: path.join(ROOT, 'src/game/games/les-quatre-vents/en-attendant-minuit/model/content/board.json'),
      allowedTypes: ['start', 'neutral', 'card', 'move', 'skip', 'finish'],
      requiredFieldsByType: { move: ['delta'], skip: ['skipTurns'] },
    }),
  );
  reports.push(
    auditCards({
      game: 'en-attendant-minuit',
      cardsPath: path.join(ROOT, 'src/game/games/les-quatre-vents/en-attendant-minuit/model/content/cards.json'),
      isHandled: minuitIsHandled,
    }),
  );

  reports.push(
    auditBoard({
      game: 'frousse-party',
      boardPath: path.join(ROOT, 'src/game/games/les-quatre-vents/frousse-party/model/content/board.json'),
      allowedTypes: ['start', 'neutral', 'card', 'finish'],
      requiredFieldsByType: {},
    }),
  );
  reports.push(
    auditCards({
      game: 'frousse-party',
      cardsPath: path.join(ROOT, 'src/game/games/les-quatre-vents/frousse-party/model/content/cards.json'),
      isHandled: frousseIsHandled,
    }),
  );

  reports.push(
    auditBoard({
      game: 'galopons-ensemble',
      boardPath: path.join(ROOT, 'src/game/games/les-quatre-vents/galopons-ensemble/model/content/board.json'),
      allowedTypes: ['start', 'neutral', 'card', 'bonus', 'skip', 'finish'],
      requiredFieldsByType: { bonus: ['apples'], skip: ['skipTurns'] },
    }),
  );
  reports.push(
    auditCards({
      game: 'galopons-ensemble',
      cardsPath: path.join(ROOT, 'src/game/games/les-quatre-vents/galopons-ensemble/model/content/cards.json'),
      isHandled: galoponsIsHandled,
    }),
  );

  reports.push(auditCaDerape());
  reports.push(auditOdyssee());

  const outPath = path.join(ROOT, 'tools', 'audit-les-quatre-vents.report.json');
  fs.writeFileSync(outPath, JSON.stringify(reports, null, 2));

  const failing = reports.filter((r) => {
    if (r.cardsUnhandled?.length) return true;
    if (r.tilesUnknownType?.length) return true;
    if (r.tilesMissingFields?.length) return true;
    if (r.game === 'ca-derape' && (r.cardsTotal !== r.cardsExpected || r.referencedMissingInDeck?.length)) return true;
    if (r.game === 'odyssee-quatre-cieux' && (r.trackLength !== 56 || r.homeLength !== 6)) return true;
    return false;
  });

  if (failing.length) {
    console.error('AUDIT FAILED');
    for (const r of failing) {
      console.error(JSON.stringify(r, null, 2));
    }
    process.exitCode = 1;
    return;
  }

  console.log('AUDIT OK');
  console.log(`Report: ${outPath}`);
}

main();
