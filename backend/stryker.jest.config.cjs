const { jest: baseConfig } = require('./package.json');

module.exports = {
  ...baseConfig,
  testRegex:
    '(platform/auth/auth|platform/ws/application/services/ws-security\\.services)\\.spec\\.ts$',
};
