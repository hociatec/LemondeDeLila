import fs from 'node:fs';
import path from 'node:path';

const gamesRoot = 'backend/src/game/games';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function listGameFolders(root) {
  const out = [];
  const groups = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory());
  for (const g of groups) {
    const groupPath = path.join(root, g.name);
    const games = fs.readdirSync(groupPath, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const game of games) out.push({ group: g.name, name: game.name, dir: path.join(groupPath, game.name) });
  }
  return out;
}

function normalizeText(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractMoveDeltaFrench(text) {
  const t = String(text ?? '');
  const numWords = {
    un: 1,
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six: 6,
  };
  const parseNumberish = (raw) => {
    const n = Number(raw);
    if (Number.isFinite(n) && n !== 0) return n;
    const key = String(raw ?? '').trim().toLowerCase();
    return numWords[key] ?? 0;
  };

  const combo = t.match(/Avancez\s+de\s+(\d+)\s+cases?,\s+puis\s+reculez\s+de\s+(\d+)\s+cases?/i);
  if (combo) return (Number(combo[1]) || 0) - (Number(combo[2]) || 0);

  const narrativeForward = t.match(/avancez[\s\S]*?d['’]\s*(\d+|un|une|deux|trois|quatre|cinq|six)\s+case/i);
  if (narrativeForward) return parseNumberish(narrativeForward[1]);
  const narrativeBack = t.match(/recul(?:ez|ant|e|es)?[\s\S]*?d['’]\s*(\d+|un|une|deux|trois|quatre|cinq|six)\s+case/i);
  if (narrativeBack) return -parseNumberish(narrativeBack[1]);

  const forward = t.match(/avancez\s+de\s+(\d+|un|une|deux|trois|quatre|cinq|six)\s+case/i);
  if (forward) return parseNumberish(forward[1]);
  const backward = t.match(/reculez\s+de\s+(\d+|un|une|deux|trois|quatre|cinq|six)\s+case/i);
  if (backward) return -parseNumberish(backward[1]);

  return 0;
}

function findManifest(dir) {
  const p = path.join(dir, 'manifest.json');
  return fs.existsSync(p) ? p : null;
}

function findCardsJson(dir) {
  const p = path.join(dir, 'model', 'content', 'cards.json');
  return fs.existsSync(p) ? p : null;
}

function findBoardJson(dir) {
  const p = path.join(dir, 'model', 'content', 'board.json');
  return fs.existsSync(p) ? p : null;
}

function parseSetupCardIds(dir) {
  const setupDir = path.join(dir, 'setup');
  if (!fs.existsSync(setupDir)) return [];
  const files = fs.readdirSync(setupDir).filter((f) => f.endsWith('.ts')).map((f) => path.join(setupDir, f));
  const ids = new Set();
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    // Matches push(12, ...), { id: 12, ... }, id: 12,
    for (const m of src.matchAll(/\bpush\s*\(\s*(\d+)\s*,/g)) ids.add(Number(m[1]));
    for (const m of src.matchAll(/\bid\s*:\s*(\d+)\b/g)) ids.add(Number(m[1]));
  }
  return [...ids].filter(Number.isFinite).sort((a, b) => a - b);
}

function parseActionSwitchCases(dir) {
  const actionsDir = path.join(dir, 'actions');
  if (!fs.existsSync(actionsDir)) return [];
  const files = fs.readdirSync(actionsDir).filter((f) => f.endsWith('.ts')).map((f) => path.join(actionsDir, f));
  const ids = new Set();
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bcase\s+(\d+)\s*:/g)) ids.add(Number(m[1]));
  }
  return [...ids].filter(Number.isFinite).sort((a, b) => a - b);
}

function missing(expected, handled) {
  const s = new Set(handled);
  return expected.filter((x) => !s.has(x));
}

// --- Game-specific card coverage analysers (text-driven) ---

function auditMinuitCards(cards) {
  const handled = [];
  const missing = [];

  for (const c of cards) {
    const kind = String(c.kind ?? '');
    const text = normalizeText([...(c.lines ?? [])].join(' '));

    // Quiz cards: handled by pendingQuiz.
    if (/quiz/i.test(kind)) {
      handled.push(c.id);
      continue;
    }

    if (extractMoveDeltaFrench(text) !== 0) {
      handled.push(c.id);
      continue;
    }

    const isHandled =
      text.includes('echangez votre position avec un autre joueur') ||
      text.includes('vous offrez un cadeau a un autre joueur') ||
      text.includes('ignorez la prochaine case malus') ||
      /ignorez la prochaine case.*passe ton tour/.test(text) ||
      text.includes('les autres joueurs avancent de 1 case, sauf vous') ||
      text.includes('piochez a nouveau une carte au lieu de lancer le de') ||
      text.includes('case neutre la plus proche derriere') ||
      /passez (deux|trois) tours/.test(text) ||
      /passez votre tour|passe ton tour/.test(text) ||
      /jusqu.?a la prochaine carte noel/.test(text) ||
      /jusqu.?a la case precedente carte noel/.test(text) ||
      text.includes('position avec le joueur juste derriere') ||
      /relancez (immediatement )?le de/.test(text) ||
      text.includes('lancez le de et avancez du nombre obtenu');

    if (isHandled) handled.push(c.id);
    else missing.push({ id: c.id, title: c.title, kind: c.kind, category: c.category });
  }

  return { handledIds: handled.sort((a, b) => a - b), missing };
}

function auditFrousseCards(cards) {
  const handled = [];
  const missing = [];

  for (const c of cards) {
    const text = normalizeText(c.text ?? '');

    if (extractMoveDeltaFrench(text) !== 0) {
      handled.push(c.id);
      continue;
    }

    const isHandled =
      /echang(er|ez) votre place/.test(text) ||
      text.includes('echangez immediatement vos places') ||
      text.includes('ignorez le prochain piege') ||
      text.includes('ignorez les pieges') ||
      text.includes('ignorez la prochaine carte fantome') ||
      /sautez\s+6\s+cases/i.test(text) ||
      /annule une farce/i.test(text) ||
      /rien ne vous arrive/i.test(text) ||
      /lancer un \d ou un \d/i.test(text) ||
      (/obtenir un 6/i.test(text) && /jusqu/i.test(text)) ||
      /obtenez pas un \d ou plus/i.test(text) ||
      text.includes('nombre pair') ||
      /n'avancerez que d'(une|un)e seule case/.test(text) ||
      text.includes('malus de moins 2') ||
      text.includes('malus de -2') ||
      text.includes('gardez le plus petit') ||
      text.includes('gardez le chiffre le plus bas') ||
      text.includes('doublez votre prochain lancer') ||
      text.includes('si vous faites un trois, reculez de 2 cases') ||
      text.includes("jusqu'a la case 40") ||
      /relancez/.test(text) && text.includes('de') ||
      text.includes('laissant les autres joueurs filer de 3 cases') ||
      text.includes('si le resultat est impair, passez votre tour') ||
      text.includes('retour a la case une') ||
      (text.includes('retournez') && text.includes('case une')) ||
      text.includes('allez en cuisine') ||
      /passez (deux|trois) tours/.test(text) ||
      /passez votre tour|passez un tour/.test(text);

    if (isHandled) handled.push(c.id);
    else missing.push({ id: c.id, category: c.category, text: c.text });
  }

  return { handledIds: handled.sort((a, b) => a - b), missing };
}

function auditGaloponsCards(cards) {
  const handled = [];
  const missing = [];

  for (const c of cards) {
    const text = normalizeText(c.text ?? '');

    if (extractMoveDeltaFrench(text) !== 0) {
      handled.push(c.id);
      continue;
    }

    const isHandled =
      text.includes('donnez-lui une pomme') ||
      text.includes('rejouez') ||
      text.includes('recevez un jeton pomme') ||
      text.includes('gagnez 1 jeton pomme') ||
      text.includes('recevez 2 jetons pomme') ||
      text.includes('recevez deux jetons pomme') ||
      text.includes('passez votre tour') ||
      text.includes('tous les joueurs restent sur place pendant un tour') ||
      text.includes("choisissez un joueur et avancez tout les deux d'une case") ||
      text.includes('aidez un autre joueur en le faisant avancer de 2 cases') ||
      text.includes("defaussez-vous d''une pomme") ||
      text.includes("defaussez-vous d'une pomme") ||
      /jusqu.?a la prochaine case foret/.test(text) ||
      /jusqu.?a la prochaine case montagne/.test(text);

    if (isHandled) handled.push(c.id);
    else missing.push({ id: c.id, category: c.category, text: c.text });
  }

  return { handledIds: handled.sort((a, b) => a - b), missing };
}

function auditCaDerapeCards(cards) {
  const handled = [];
  const missingCards = [];

  for (const c of cards) {
    const kind = String(c.kind ?? '');
    const text = normalizeText(c.text ?? '');
    const moveDelta = typeof c.moveDelta === 'number' ? c.moveDelta : null;

    const isHandled =
      kind === 'neutral' ||
      kind === 'move' ||
      kind === 'skip' ||
      kind === 'swap' ||
      kind === 'global' ||
      kind === 'conditional' ||
      (kind === 'rule' && text.includes('lancer le de deux fois')) ||
      (kind === 'rule' && text.startsWith('pioche une carte')) ||
      (kind === 'rule' && text.includes('prochain deplacement est doubl')) ||
      (kind === 'rule' && text.includes('prochain recul est ignor')) ||
      (kind === 'rule' && text.includes('prochain lancer') && text.includes('compte double')) ||
      (kind === 'rule' && text.includes('devient egal au sien')) ||
      (kind === 'rule' && text.includes('recule de 3 cases puis avance de 2')) ||
      (kind === 'rule' && text.includes('avance de 3 cases puis recule de 1')) ||
      (kind === 'rule' && text.includes('choisis qui joue')) ||
      (kind === 'rule' && text.includes('tu decides si le prochain joueur'));

    if (kind === 'move' && moveDelta == null) {
      missingCards.push({ id: c.id, title: c.title, issue: 'move sans moveDelta', kind: c.kind, text: c.text });
      continue;
    }

    if (isHandled) handled.push(c.id);
    else missingCards.push({ id: c.id, title: c.title, kind: c.kind, text: c.text });
  }

  return { handledIds: handled.sort((a, b) => a - b), missing: missingCards };
}

function auditAventureSauvageCards(cards) {
  const missing = [];
  for (const c of cards) {
    const isNoOp = !c.moveDelta && !c.skipTurns && !c.reroll;
    const isSpecial = c.deck === 'animal' && c.id === 17;
    if (isNoOp && !isSpecial && !/restez sur place/i.test(c.text ?? '')) {
      missing.push({ id: c.id, deck: c.deck, text: c.text });
    }
  }
  return { missing };
}

function auditGame(game) {
  const manifestPath = findManifest(game.dir);
  if (!manifestPath) return null;
  const manifest = readJson(manifestPath);
  if (manifest.enabled === false) return null;

  const id = manifest.code ?? manifest.id ?? game.name;

  const cardsJson = findCardsJson(game.dir);
  const boardJson = findBoardJson(game.dir);

  const report = {
    id,
    group: game.group,
    dir: game.dir,
    cards: null,
    board: null,
    switches: null,
  };

  if (boardJson) {
    const board = readJson(boardJson);
    const tiles = Array.isArray(board.tiles) ? board.tiles : [];
    const types = [...new Set(tiles.map((t) => String(t?.type ?? '')))].filter(Boolean).sort();
    report.board = { tiles: tiles.length, types };
  }

  if (cardsJson) {
    const data = readJson(cardsJson);
    const cards = Array.isArray(data.cards) ? data.cards : [];
    const ids = cards.map((c) => c.id).filter(Number.isFinite).sort((a, b) => a - b);
    report.cards = { count: cards.length, idsRange: ids.length ? `${ids[0]}..${ids.at(-1)}` : '(none)' };

    if (id === 'en-attendant-minuit') {
      const res = auditMinuitCards(cards);
      report.cards.audit = { missing: res.missing, missingCount: res.missing.length };
    } else if (id === 'frousse-party') {
      const res = auditFrousseCards(cards);
      report.cards.audit = { missing: res.missing, missingCount: res.missing.length };
    } else if (id === 'galopons-ensemble') {
      const res = auditGaloponsCards(cards);
      report.cards.audit = { missing: res.missing, missingCount: res.missing.length };
    }
  } else {
    // Setup-built decks: compare ids vs switch cases (best-effort)
    const expected = parseSetupCardIds(game.dir);
    const handled = parseActionSwitchCases(game.dir);
    if (expected.length && handled.length) {
      report.switches = {
        expectedRange: `${expected[0]}..${expected.at(-1)}`,
        expectedCount: expected.length,
        handledCount: handled.length,
        missing: missing(expected, handled),
      };
    }

    if (id === 'ca-derape') {
      // Cards are in setup for this game
      const setupFile = path.join(game.dir, 'setup', 'ca.setup.ts');
      if (fs.existsSync(setupFile)) {
        const src = fs.readFileSync(setupFile, 'utf8');
        const matches = [...src.matchAll(/push\(\s*(\d+)\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'/g)];
        const cards = matches.map((m) => ({
          id: Number(m[1]),
          title: m[2],
          category: m[3],
          kind: m[4],
          text: m[5],
        }));
        const res = auditCaDerapeCards(cards);
        report.cards = {
          count: cards.length,
          idsRange: cards.length ? `${cards[0].id}..${cards.at(-1).id}` : '(none)',
          audit: { missing: res.missing, missingCount: res.missing.length },
        };
      }
    }

    if (id === 'aventure-sauvage') {
      const setupFile = path.join(game.dir, 'setup', 'aventure-sauvage-setup.service.ts');
      if (fs.existsSync(setupFile)) {
        const src = fs.readFileSync(setupFile, 'utf8');
        const matches = [...src.matchAll(/\{\s*id:\s*(\d+),\s*deck:\s*'([^']+)',\s*text:\s*'([^']+)'([^}]*)\}/g)];
        const cards = matches.map((m) => {
          const tail = m[4] ?? '';
          const moveDelta = /moveDelta:\s*(-?\d+)/.exec(tail)?.[1];
          const skipTurns = /skipTurns:\s*(\d+)/.exec(tail)?.[1];
          const reroll = /reroll:\s*true/.test(tail);
          return {
            id: Number(m[1]),
            deck: m[2],
            text: m[3],
            moveDelta: moveDelta != null ? Number(moveDelta) : undefined,
            skipTurns: skipTurns != null ? Number(skipTurns) : undefined,
            reroll,
          };
        });
        const res = auditAventureSauvageCards(cards);
        report.cards = { count: cards.length, audit: { missing: res.missing, missingCount: res.missing.length } };
      }
    }
  }

  if (id === 'contes-et-cacahuetes') {
    // Ce jeu a bien des cartes Conte (1..29) mais elles sont seulement annoncées (pas d'effet par ID).
    // Les audits basés sur switch/case seraient trompeurs.
    report.switches = null;
  }

  return report;
}

const games = listGameFolders(gamesRoot);
const reports = games.map(auditGame).filter(Boolean);

for (const r of reports) {
  const missingCount = r.cards?.audit?.missingCount ?? r.switches?.missing?.length ?? 0;
  if (missingCount > 0) {
    console.log(`\n[${r.id}] missing=${missingCount}`);
    if (r.cards?.audit?.missing?.length) {
      console.log('cards missing:', r.cards.audit.missing.slice(0, 20));
      if (r.cards.audit.missing.length > 20) console.log(`... +${r.cards.audit.missing.length - 20} more`);
    }
    if (r.switches?.missing?.length) {
      console.log('switch missing ids:', r.switches.missing.join(', '));
    }
  }
}

const totalMissing = reports.reduce((acc, r) => acc + (r.cards?.audit?.missingCount ?? r.switches?.missing?.length ?? 0), 0);
console.log(`\nTOTAL missing items: ${totalMissing}`);
