'use strict';
const path = require('node:path');

function scopeDirectory(scope) {
  if (!['reusable', 'engine-primitive'].includes(scope))
    throw new Error(`Invalid engine-extension scope: ${scope}`);
  return scope === 'engine-primitive' ? 'primitives' : scope;
}
function engineExtensionDirectory(rules, name, profile) {
  if (!/^[a-z]+(?:-[a-z]+)+$/.test(name))
    throw new Error(`Invalid extension name: ${name}`);
  return path.join(rules, scopeDirectory(profile.scope), name);
}
module.exports = { scopeDirectory, engineExtensionDirectory };
