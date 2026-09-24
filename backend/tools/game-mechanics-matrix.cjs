'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const normalize = (file) => path.relative(root, file).replaceAll('\\', '/');
const rules = {
  movement: /\bmovement\.|\bpawns\.|movement\.track|pawn\.set/,
  ownership: /\bownership\.|ownership\.registry/,
  collision: /firstOtherPlayerAt|\bcollision\b|\bcapture\b/,
  resources:
    /\bresources\.|resourceDeltaEffects|gain-resource|lose-resource|transfer-resource/,
  payment:
    /settleResource|\bpayment\b|\bpay\b|\brent\b|\.resources\.(remove|transfer|exchange)/,
  cards: /\bcards\.|draw-cards|discard-card/,
  zones: /cards\.zone|\.cards\.(zone|move|reveal|hide|discard|draw)/,
  choices: /\bchoice\.|defineChoice|selectCards|\.voting\.|\.submissions\./,
  status: /\bstatus\.|add-status|remove-status/,
  collections:
    /cards\.sets|\bcollection\.|completedSets|completeSet|requestCardFromPlayer/,
  scoring: /\bscore\.|gain-score|roundScoring/,
  victory: /\bvictory\b|\.match\.finish|victoryWhen|thresholdVictory/,
  targeting:
    /\btarget\b|targetPlayerIds|otherIds|firstOtherPlayerAt|\.players\.(after|before|next|previous)/,
  triggers: /\bevents\b|onLand|onPass|onTurn|automatic|\.on\(/,
};

function files(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory() ? files(file) : [file];
    })
    .sort();
}

function buildMatrix() {
  const packRoot = path.join(root, 'src/game/rules/game-specific');
  const packs = fs
    .readdirSync(packRoot)
    .filter((name) =>
      fs.existsSync(path.join(packRoot, name, 'effect-pack.ts')),
    )
    .map((name) => {
      const directory = path.join(packRoot, name);
      const source = fs.readFileSync(
        path.join(directory, 'effect-pack.ts'),
        'utf8',
      );
      const type = source.match(/documentKey:\s*'([^']+)'/)?.[1];
      if (!type) throw new Error(`Missing documentKey: ${name}`);
      return {
        name,
        type,
        files: files(directory).filter(
          (file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'),
        ),
      };
    });
  const games = files(path.join(root, 'src/game/games'))
    .filter((file) => path.basename(file) === 'game.json')
    .map((file) => {
      const document = JSON.parse(fs.readFileSync(file, 'utf8'));
      const manifest = JSON.parse(
        fs.readFileSync(path.join(path.dirname(file), 'manifest.json'), 'utf8'),
      );
      const consumers = (document.extensions ?? []).map(({ type }) => {
        const pack = packs.find((candidate) => candidate.type === type);
        if (!pack) throw new Error(`Missing pack ${type} for ${manifest.code}`);
        return pack;
      });
      const sources = [
        ...files(path.dirname(file)).filter((entry) =>
          /\.(json|ts)$/.test(entry),
        ),
        ...consumers.flatMap((pack) => pack.files),
      ];
      const mechanics = Object.fromEntries(
        Object.entries(rules).map(([name, pattern]) => [
          name,
          sources.flatMap((source) =>
            fs
              .readFileSync(source, 'utf8')
              .split(/\r?\n/)
              .flatMap((line, index) =>
                pattern.test(line) ? [`${normalize(source)}:${index + 1}`] : [],
              ),
          ),
        ]),
      );
      return {
        id: manifest.code,
        packs: consumers.map((pack) => pack.name),
        mechanics,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    method:
      'Static evidence in game content and each installed pack. Empty cells mean no direct evidence; shared runtime services may still supply the capability.',
    games,
    packs: packs.map((pack) => ({
      name: pack.name,
      consumers: games
        .filter((game) => game.packs.includes(pack.name))
        .map((game) => game.id),
    })),
  };
}

function render(matrix) {
  const keys = Object.keys(rules);
  return (
    '# Matrice des mécaniques du catalogue\n\n' +
    'Générée par `node tools/game-mechanics-matrix.cjs --write`. Les preuves détaillées (fichier et ligne) sont dans le JSON associé. Une case vide signifie absence de preuve directe, pas absence certaine de fonctionnalité.\n\n' +
    `| Jeu | ${keys.join(' | ')} |\n| --- | ${keys.map(() => '---').join(' | ')} |\n` +
    matrix.games
      .map(
        (game) =>
          `| ${game.id} | ${keys.map((key) => (game.mechanics[key].length ? '✓' : '')).join(' | ')} |`,
      )
      .join('\n') +
    '\n'
  );
}

if (require.main === module) {
  const matrix = buildMatrix();
  for (const [name, content] of [
    ['game-mechanics-matrix.json', JSON.stringify(matrix, null, 2) + '\n'],
    ['game-mechanics-matrix.md', render(matrix)],
  ]) {
    const file = path.join(root, 'docs/quality', name);
    if (process.argv.includes('--write')) fs.writeFileSync(file, content);
    else if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content)
      throw new Error(`Stale mechanics matrix: ${name}`);
  }
  console.log(
    `${matrix.games.length} games, ${matrix.packs.length} packs, ${Object.keys(rules).length} mechanics`,
  );
}
module.exports = { buildMatrix, render };
