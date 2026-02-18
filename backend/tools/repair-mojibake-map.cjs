const fs = require('fs');
const path = require('path');

const MAP = new Map([
  ['Ã€', 'À'],
  ['Ã', 'Á'],
  ['Ã‚', 'Â'],
  ['Ãƒ', 'Ã'],
  ['Ã„', 'Ä'],
  ['Ã…', 'Å'],
  ['Ã†', 'Æ'],
  ['Ã‡', 'Ç'],
  ['Ãˆ', 'È'],
  ['Ã‰', 'É'],
  ['ÃŠ', 'Ê'],
  ['Ã‹', 'Ë'],
  ['ÃŒ', 'Ì'],
  ['Ã', 'Í'],
  ['ÃŽ', 'Î'],
  ['Ã', 'Ï'],
  ['Ã‘', 'Ñ'],
  ['Ã’', 'Ò'],
  ['Ã“', 'Ó'],
  ['Ã”', 'Ô'],
  ['Ã•', 'Õ'],
  ['Ã–', 'Ö'],
  ['Ã™', 'Ù'],
  ['Ãš', 'Ú'],
  ['Ã›', 'Û'],
  ['Ãœ', 'Ü'],
  ['ÃŸ', 'ß'],
  ['Ã ', 'à'],
  ['Ã¡', 'á'],
  ['Ã¢', 'â'],
  ['Ã£', 'ã'],
  ['Ã¤', 'ä'],
  ['Ã¥', 'å'],
  ['Ã¦', 'æ'],
  ['Ã§', 'ç'],
  ['Ã¨', 'è'],
  ['Ã©', 'é'],
  ['Ãª', 'ê'],
  ['Ã«', 'ë'],
  ['Ã¬', 'ì'],
  ['Ã­', 'í'],
  ['Ã®', 'î'],
  ['Ã¯', 'ï'],
  ['Ã±', 'ñ'],
  ['Ã²', 'ò'],
  ['Ã³', 'ó'],
  ['Ã´', 'ô'],
  ['Ãµ', 'õ'],
  ['Ã¶', 'ö'],
  ['Ã¹', 'ù'],
  ['Ãº', 'ú'],
  ['Ã»', 'û'],
  ['Ã¼', 'ü'],
  ['Å“', 'œ'],
  ['Å’', 'Œ'],
  ['Â°', '°'],
  ['Â«', '«'],
  ['Â»', '»'],
  ['Â·', '·'],
  ['Â ', ' '],
  ['â€“', '–'],
  ['â€”', '—'],
  ['â€¦', '…'],
  ['â€˜', '‘'],
  ['â€™', '’'],
  ['â€œ', '“'],
  ['â€', '”'],
  ['â€¢', '•'],
  ['â‚¬', '€'],
  ['ÃƒÂ€', 'À'],
  ['ÃƒÂ©', 'é'],
  ['ÃƒÂ¨', 'è'],
  ['ÃƒÂª', 'ê'],
  ['ÃƒÂ«', 'ë'],
  ['ÃƒÂ ', 'à'],
  ['ÃƒÂ¢', 'â'],
  ['ÃƒÂ§', 'ç'],
  ['ÃƒÂ¹', 'ù'],
  ['ÃƒÂ»', 'û'],
  ['ÃƒÂ®', 'î'],
  ['ÃƒÂ´', 'ô'],
  ['ÃƒÂ‰', 'É'],
  ['ÃƒÂ¨', 'è'],
  ['ÃƒÂª', 'ê'],
]);

function repair(input) {
  let out = input;
  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false;
    for (const [bad, good] of MAP.entries()) {
      if (out.includes(bad)) {
        out = out.split(bad).join(good);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return out;
}

const files =
  process.argv.slice(2).filter(Boolean).length > 0
    ? process.argv.slice(2).filter(Boolean)
    : fs
        .readFileSync(0, 'utf8')
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
let changedFiles = 0;

for (const relPath of files) {
  const filePath = path.resolve(relPath);
  if (!fs.existsSync(filePath)) continue;
  const before = fs.readFileSync(filePath, 'utf8');
  const after = repair(before);
  if (after === before) continue;
  fs.writeFileSync(filePath, after, 'utf8');
  changedFiles += 1;
  process.stdout.write(`fixed: ${relPath}\n`);
}

process.stdout.write(`changed_files=${changedFiles}\n`);
