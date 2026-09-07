import type {
  DefinitionToValidate,
  ValidationFailure,
} from './game-definition-validator';

export function assertAuxiliaryDefinitions(
  definition: DefinitionToValidate,
  fail: ValidationFailure,
): void {
  const automaticIds = new Set<string>();
  for (const automatic of definition.automatic ?? []) {
    if (!automatic.id.trim())
      fail('automatic', 'identifiant de règle automatique vide');
    if (automaticIds.has(automatic.id))
      fail('automatic', `règle dupliquée « ${automatic.id} »`);
    if (automatic.priority != null && !Number.isFinite(automatic.priority)) {
      fail(
        `automatic.${automatic.id}.priority`,
        'la priorité doit être un nombre fini',
      );
    }
    automaticIds.add(automatic.id);
  }
  for (const [id, choice] of Object.entries(definition.choices ?? {})) {
    if (!choice.input || typeof choice.input !== 'object')
      fail(`choices.${id}.input`, 'un schéma de valeur est requis');
  }
  for (const [id, effect] of Object.entries(definition.effects ?? {})) {
    if (!id.trim()) fail('effects', 'identifiant d’effet vide');
    if (!effect.input || typeof effect.input !== 'object')
      fail(`effects.${id}.input`, 'un schéma de données est requis');
    if (typeof effect.resolveRaw !== 'function')
      fail(`effects.${id}.resolveRaw`, 'un resolver est requis');
  }
}

export function assertConfiguration(
  definition: DefinitionToValidate,
  phaseNames: ReadonlySet<string>,
  fail: ValidationFailure,
): void {
  const config = definition.config;
  if (!config) return;
  if (
    typeof config.input?.parse !== 'function' ||
    typeof config.input.describe !== 'function'
  ) {
    fail('config.input', 'un schéma de configuration est requis');
  }
  if (
    config.defaults == null ||
    typeof config.defaults !== 'object' ||
    Array.isArray(config.defaults)
  ) {
    fail('config.defaults', 'un objet de valeurs par défaut est requis');
  }
  if (phaseNames.size > 0 && config.phase && !phaseNames.has(config.phase)) {
    fail('config.phase', `phase inconnue « ${config.phase} »`);
  }
  if (
    config.permission != null &&
    !['owner', 'any-player'].includes(config.permission)
  ) {
    fail('config.permission', 'permission inconnue');
  }
}
