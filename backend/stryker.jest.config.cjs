const { jest: baseConfig } = require('./package.json');

module.exports = {
  ...baseConfig,
  testRegex:
    '(platform/auth/(auth|application/services/jwt-config\\.service|infrastructure/presentation/http/jwks\\.controller)|platform/ws/application/services/ws-security\\.services|modules/admin/infrastructure/presentation/http/guards/admin-maintenance\\.guard|modules/update/infrastructure/persistence/wx-update-(release\\.(di|service)|upload\\.service|upload-atomicity))\\.spec\\.ts$',
};
