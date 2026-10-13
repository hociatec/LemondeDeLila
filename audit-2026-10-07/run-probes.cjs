const path = require('path');
const config = structuredClone(require('../backend/package.json').jest);
config.rootDir = path.resolve(__dirname, '../backend/src');
config.roots = [__dirname];
config.transform = Object.fromEntries(Object.entries(config.transform).filter(([key]) => key.includes('ts')));
config.transform['^.+\\.js$'] = path.join(__dirname, 'transform-js.cjs');
config.transformIgnorePatterns = ['/node_modules/(?!is-stream/)'];
config.moduleDirectories = [path.resolve(__dirname, '../backend/node_modules'), 'node_modules'];
const args = process.argv.slice(2);
if (args[0] === '--existing') { config.roots = [config.rootDir]; args.shift(); }
require('../backend/node_modules/jest').run(['--config', JSON.stringify(config), '--runInBand', '--no-coverage', '--testTimeout=20000', ...args]);
