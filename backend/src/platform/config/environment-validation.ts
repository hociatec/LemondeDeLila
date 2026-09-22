import * as Joi from 'joi';
import {
  coreEnvironment,
  databaseEnvironment,
  authEnvironment,
  redisAndRateLimitEnvironment,
  runtimeEnvironment,
  updateEnvironment,
  websocketEnvironment,
} from './environment-core-options';
import { applicationEnvironment } from './environment-application-options';
import { operationalEnvironment } from './environment-operational-options';

type EnvValidationInput = Record<string, unknown>;

export const environmentValidationSchema = Joi.object({
  ...applicationEnvironment,
  ...operationalEnvironment,
  ...coreEnvironment,
  ...databaseEnvironment,
  ...authEnvironment,
  ...redisAndRateLimitEnvironment,
  ...runtimeEnvironment,
  ...updateEnvironment,
  ...websocketEnvironment,
})
  .custom(validateCrossModuleEnvironment)
  .messages({ 'any.custom': '{{#message}}' });

export function shouldIgnoreEnvironmentFile(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return (environment.IGNORE_ENV_FILE ?? '').trim().toLowerCase() === 'true';
}

function validateCrossModuleEnvironment(
  rawEnvironment: unknown,
  helpers: Joi.CustomHelpers,
): EnvValidationInput | Joi.ErrorReport {
  const environment = rawEnvironment as EnvValidationInput;
  const bioMin = Number(environment['PROFILE_BIO_MIN_LENGTH']);
  const bioMax = Number(environment['PROFILE_BIO_MAX_LENGTH']);
  if (
    Number.isFinite(bioMin) &&
    Number.isFinite(bioMax) &&
    (bioMin < 0 ||
      bioMax < 0 ||
      bioMin > 10000 ||
      bioMax > 10000 ||
      bioMin > bioMax)
  ) {
    return customError(
      helpers,
      'PROFILE_BIO_MIN_LENGTH ne peut pas dépasser PROFILE_BIO_MAX_LENGTH',
    );
  }
  if (
    normalizedString(environment['NODE_ENV'], 'DEVELOPMENT') === 'PRODUCTION'
  ) {
    const productionError = validateProductionEnvironment(environment, helpers);
    if (productionError) return productionError;
  }
  return validateJwtEnvironment(environment, helpers);
}

function validateProductionEnvironment(
  environment: EnvValidationInput,
  helpers: Joi.CustomHelpers,
): Joi.ErrorReport | null {
  if (!environment['SESSION_STORE_REDIS_URL']) {
    return customError(
      helpers,
      'SESSION_STORE_REDIS_URL est requis en production',
    );
  }
  if (!environment['GAME_ENGINE_STATE_REDIS_URL']) {
    return customError(
      helpers,
      'GAME_ENGINE_STATE_REDIS_URL est requis en production',
    );
  }
  if (!environment['RATE_LIMIT_REDIS_URL']) {
    return customError(
      helpers,
      'RATE_LIMIT_REDIS_URL est requis en production',
    );
  }
  if (environment['OTEL_SDK_DISABLED'] === true) {
    return customError(
      helpers,
      'OTEL_SDK_DISABLED doit être désactivé en production',
    );
  }
  if (
    !environment['OTEL_EXPORTER_OTLP_ENDPOINT'] &&
    !environment['OTEL_EXPORTER_OTLP_TRACES_ENDPOINT']
  ) {
    return customError(helpers, 'Un endpoint OTLP est requis en production');
  }
  if (normalizedString(environment['JWT_ALGORITHM']) !== 'RS256') {
    return customError(helpers, 'JWT_ALGORITHM=RS256 est requis en production');
  }
  if (!nonEmptyString(environment['JWT_AUDIENCE'])) {
    return customError(helpers, 'JWT_AUDIENCE est requis en production');
  }
  const databaseError = validateProductionDatabase(environment, helpers);
  if (databaseError) return databaseError;
  if (!validProductionSecret(environment['WS_TICKET_SECRET'])) {
    return customError(
      helpers,
      'WS_TICKET_SECRET doit être un secret non générique en production',
    );
  }
  if (!validProductionSecret(environment['CLIENT_WX_UPDATES_UPLOAD_TOKEN'])) {
    return customError(
      helpers,
      'CLIENT_WX_UPDATES_UPLOAD_TOKEN est requis et doit contenir au moins 32 caractères en production',
    );
  }
  const maintenanceError = validateProductionMaintenance(environment, helpers);
  if (maintenanceError) return maintenanceError;
  return validateProductionClientUpdates(environment, helpers);
}

function validateProductionMaintenance(
  environment: EnvValidationInput,
  helpers: Joi.CustomHelpers,
): Joi.ErrorReport | null {
  if (environment['ADMIN_MAINTENANCE_ENABLED'] !== true) return null;
  if (environment['ADMIN_MAINTENANCE_REQUIRE_TOKEN'] !== true) {
    return customError(
      helpers,
      'ADMIN_MAINTENANCE_REQUIRE_TOKEN doit être activé en production',
    );
  }
  if (!validProductionSecret(environment['ADMIN_MAINTENANCE_TOKEN'])) {
    return customError(
      helpers,
      'ADMIN_MAINTENANCE_TOKEN doit contenir au moins 32 caractères en production',
    );
  }
  if (!nonEmptyString(environment['ADMIN_MAINTENANCE_ALLOWED_IPS'])) {
    return customError(
      helpers,
      'ADMIN_MAINTENANCE_ALLOWED_IPS est requis quand la maintenance est activée en production',
    );
  }
  return null;
}

function validateProductionClientUpdates(
  environment: EnvValidationInput,
  helpers: Joi.CustomHelpers,
): Joi.ErrorReport | null {
  if (environment['CLIENT_WX_ALLOW_UNSIGNED'] === '1') {
    return customError(
      helpers,
      'CLIENT_WX_ALLOW_UNSIGNED est interdit en production',
    );
  }
  if (
    !environment['CLIENT_WX_SIGNATURE_PUBLIC_KEY_DER_BASE64'] &&
    !environment['CLIENT_WX_SIGNATURE_PUBLIC_KEY_PEM'] &&
    !environment['CLIENT_WX_SIGNATURE_PUBLIC_KEY_PATH']
  ) {
    return customError(
      helpers,
      'Une clé publique CLIENT_WX_SIGNATURE_PUBLIC_KEY_* est requise en production',
    );
  }
  const publicUrl = environment['CLIENT_WX_UPDATES_PUBLIC_URL'];
  if (typeof publicUrl !== 'string' || !/^https:\/\//i.test(publicUrl)) {
    return customError(
      helpers,
      'CLIENT_WX_UPDATES_PUBLIC_URL doit être une URL HTTPS absolue en production',
    );
  }
  return null;
}

function validateJwtEnvironment(
  environment: EnvValidationInput,
  helpers: Joi.CustomHelpers,
): EnvValidationInput | Joi.ErrorReport {
  if (
    !environment['JWT_PRIVATE_KEY_PEM'] &&
    !environment['JWT_PRIVATE_KEY_PATH']
  ) {
    return customError(
      helpers,
      'JWT_PRIVATE_KEY_PEM ou JWT_PRIVATE_KEY_PATH est requis en mode RS256',
    );
  }
  if (
    !environment['JWT_PUBLIC_KEY_PEM'] &&
    !environment['JWT_PUBLIC_KEY_PATH']
  ) {
    return customError(
      helpers,
      'JWT_PUBLIC_KEY_PEM ou JWT_PUBLIC_KEY_PATH est requis en mode RS256',
    );
  }
  return environment;
}

function normalizedString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : fallback;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validProductionSecret(value: unknown): boolean {
  if (!nonEmptyString(value) || value.trim().length < 32) return false;
  const normalized = value.trim().toLowerCase();
  return ![
    'change-me-with-at-least-32-characters',
    'changeme',
    'secret',
    'password',
  ].includes(normalized);
}

function validateProductionDatabase(
  environment: EnvValidationInput,
  helpers: Joi.CustomHelpers,
): Joi.ErrorReport | null {
  const databaseUrl = environment['DATABASE_URL'];
  if (nonEmptyString(databaseUrl)) {
    try {
      const parsed = new URL(databaseUrl);
      if (
        !parsed.username ||
        parsed.username.toLowerCase() === 'root' ||
        !validConfigurationValue(decodeURIComponent(parsed.password))
      ) {
        return customError(
          helpers,
          'DATABASE_URL doit utiliser un compte non-root avec mot de passe en production',
        );
      }
      return null;
    } catch {
      return customError(helpers, 'DATABASE_URL est invalide');
    }
  }
  if (normalizedString(environment['DB_USER']) === 'ROOT') {
    return customError(helpers, 'DB_USER=root est interdit en production');
  }
  if (!validConfigurationValue(environment['DB_PASSWORD'])) {
    return customError(helpers, 'DB_PASSWORD est requis en production');
  }
  return null;
}

function validConfigurationValue(value: unknown): boolean {
  if (!nonEmptyString(value)) return false;
  const normalized = value.trim().toLowerCase();
  return !(
    normalized.startsWith('<') ||
    normalized.includes('change-me') ||
    ['changeme', 'password', 'secret'].includes(normalized)
  );
}

function customError(
  helpers: Joi.CustomHelpers,
  message: string,
): Joi.ErrorReport {
  return helpers.error('any.custom', { message });
}
