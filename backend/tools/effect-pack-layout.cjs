'use strict';
const path = require('node:path');

function scopeDirectory(scope) {
  if (!['game-specific', 'reusable', 'engine-primitive'].includes(scope))
    throw new Error(`Invalid effect-pack scope: ${scope}`);
  return scope === 'engine-primitive' ? 'primitives' : scope;
}
function effectPackDirectory(rules, name, profile) {
  if (!/^[a-z]+(?:-[a-z]+)+$/.test(name))
    throw new Error(`Invalid pack name: ${name}`);
  return path.join(rules, scopeDirectory(profile.scope), name);
}
module.exports = { scopeDirectory, effectPackDirectory };
