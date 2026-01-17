const fs = require('fs');
const path = require('path');

function listFilesRecursive(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(abs));
    } else if (entry.isFile()) {
      out.push(abs);
    }
  }
  return out;
}

function readJson(absPath) {
  const raw = fs.readFileSync(absPath, 'utf8');
  // Supprime BOM UTF-8 si present (U+FEFF) pour eviter "Unexpected token" au JSON.parse.
  const normalized = raw.replace(/^\uFEFF/, '');
  return JSON.parse(normalized);
}

function fail(errors) {
  for (const e of errors) {
    process.stderr.write(`[verify:dist] ${e}\n`);
  }
  process.exit(1);
}

function ok(message) {
  process.stdout.write(`[verify:dist] ${message}\n`);
}

function main() {
  const cwd = process.cwd();
  const distGames = path.join(cwd, 'dist', 'game', 'games');
  if (!fs.existsSync(distGames)) {
    fail([`dossier introuvable: ${distGames} (lance d'abord: npm run build)`]);
  }

  const files = listFilesRecursive(distGames);
  const manifests = files.filter((f) => path.basename(f) === 'manifest.json');
  if (manifests.length === 0) {
    fail([`aucun manifest.json trouve sous ${distGames}`]);
  }

  const errors = [];
  const firstManifestByCode = new Map();
  let validManifests = 0;
  let checkedContentJson = 0;

  for (const manifestPath of manifests) {
    const gameDir = path.dirname(manifestPath);
    let manifest;
    try {
      manifest = readJson(manifestPath);
    } catch (e) {
      errors.push(`manifest invalide (JSON): ${manifestPath} (${String(e)})`);
      continue;
    }
    const code = typeof manifest?.code === 'string' ? manifest.code : null;
    const name = typeof manifest?.name === 'string' ? manifest.name : null;
    const engine = typeof manifest?.engine === 'string' ? manifest.engine : null;
    if (!code) errors.push(`manifest sans "code": ${manifestPath}`);
    if (!name) errors.push(`manifest sans "name": ${manifestPath}`);
    if (!engine) errors.push(`manifest sans "engine": ${manifestPath}`);

    if (code) {
      const prev = firstManifestByCode.get(code);
      if (prev && prev !== manifestPath) {
        errors.push(
          `doublon de jeu (code="${code}"): ${prev} ET ${manifestPath}`,
        );
      } else {
        firstManifestByCode.set(code, manifestPath);
      }
    }

    const rulesPath = path.join(gameDir, 'rules.md');
    if (!fs.existsSync(rulesPath)) {
      errors.push(`rules.md manquant: ${rulesPath}`);
    }

    const contentDir = path.join(gameDir, 'model', 'content');
    if (fs.existsSync(contentDir)) {
      const contentFiles = listFilesRecursive(contentDir).filter((f) =>
        f.toLowerCase().endsWith('.json'),
      );
      for (const f of contentFiles) {
        try {
          readJson(f);
          checkedContentJson += 1;
        } catch (e) {
          errors.push(`content JSON invalide: ${f} (${String(e)})`);
        }
      }
    }

    validManifests += 1;
  }

  if (errors.length) fail(errors);
  ok(
    `OK: ${validManifests} manifest(s), ${checkedContentJson} content json valide(s)`,
  );
}

main();
