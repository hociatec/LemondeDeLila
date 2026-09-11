import type {
  DefinitionToValidate,
  ValidationFailure,
} from '../contracts/definition-validation';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import { isGameDelay } from '../automation/game-deadline';

import { assertInitializationReferences } from './component-initialization-references';
import { assertInitializationValues } from './initialization-value-validation';
import { assertComponentDefinitions } from './game-definition-component-validator';
import { validateStaticContent } from '../content/game-content';
import { assertPhaseGraph } from './game-phase-graph-validator';
import {
  assertAuxiliaryDefinitions,
  assertConfiguration,
} from './game-definition-auxiliary-validator';

export function assertGameDefinition(definition: DefinitionToValidate): void {
  const fail: ValidationFailure = (path, reason) => {
    throw new GameConfigurationError(
      `Définition ${definition.id || '<sans identifiant>'}.${path}: ${reason}`,
    );
  };
  assertMetadata(definition, fail);
  const actionNames = assertActionsAndEvents(definition, fail);
  const phaseNames = assertPhases(definition, actionNames, fail);
  assertPhaseGraph(definition, fail);
  assertComponentDefinitions(definition, fail);
  assertInitializationValues(definition.initialization, fail);
  assertInitializationReferences(
    definition.components ?? [],
    definition.initialization,
    fail,
  );
  assertAuxiliaryDefinitions(definition, fail);
  assertConfiguration(definition, phaseNames, fail);
}

function assertMetadata(
  definition: DefinitionToValidate,
  fail: ValidationFailure,
): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(definition.id))
    fail('id', 'format invalide');
  if (
    !Number.isInteger(definition.players.min) ||
    !Number.isInteger(definition.players.max) ||
    definition.players.min < 1 ||
    definition.players.max < definition.players.min ||
    definition.players.max > 64
  )
    fail('players', 'limites de joueurs invalides');
  if (
    definition.stateVersion != null &&
    (!Number.isInteger(definition.stateVersion) || definition.stateVersion < 1)
  ) {
    fail('stateVersion', 'un entier positif est requis');
  }
  for (const [path, version] of [
    ['rulesVersion', definition.rulesVersion],
    ['contentVersion', definition.contentVersion],
  ] as const) {
    if (
      version != null &&
      (version.trim().length === 0 || version.length > 128)
    )
      fail(path, 'la version ne peut pas être vide');
  }
  const content = definition.content;
  if (!content) return;
  if (content.kind !== 'lila.game-content')
    fail('content.kind', 'utiliser defineGameContent');
  if (content.gameId !== definition.id) {
    fail(
      'content.gameId',
      `identifiant « ${String(content.gameId)} » différent du jeu`,
    );
  }
  if (
    typeof content.version !== 'string' ||
    content.version.trim().length === 0
  ) {
    fail('content.version', 'version de contenu requise');
  }
  if (
    content.data == null ||
    typeof content.data !== 'object' ||
    !Object.isFrozen(content) ||
    !Object.isFrozen(content.data)
  )
    fail('content', 'le contenu statique doit être immuable');
  validateStaticContent(content.data, `${definition.id}.content`);
}

function assertActionsAndEvents(
  definition: DefinitionToValidate,
  fail: ValidationFailure,
): Set<string> {
  const names = new Set(Object.keys(definition.actions));
  if (names.size === 0) fail('actions', 'au moins une action est requise');
  assertEventDefinitions(definition.events ?? [], fail);
  for (const [name, action] of Object.entries(definition.actions)) {
    if (
      action.enumerateInputs != null &&
      typeof action.validateInput !== 'function'
    ) {
      fail(
        `actions.${name}.validate`,
        'une action énumérée doit déclarer une validation serveur',
      );
    }
  }
  return names;
}

function assertPhases(
  definition: DefinitionToValidate,
  actionNames: ReadonlySet<string>,
  fail: ValidationFailure,
): Set<string> {
  const names = new Set(Object.keys(definition.phases ?? {}));
  if (
    names.size > 0 &&
    definition.initialPhase &&
    !names.has(definition.initialPhase)
  ) {
    fail('initialPhase', `phase inconnue « ${definition.initialPhase} »`);
  }
  for (const [name, phase] of Object.entries(definition.phases ?? {})) {
    for (const action of phase.actions ?? []) {
      if (!actionNames.has(action))
        fail(`phases.${name}.actions`, `action inconnue « ${action} »`);
    }
    if (phase.next && !names.has(phase.next))
      fail(`phases.${name}.next`, `phase inconnue « ${phase.next} »`);
    if (
      phase.visibility != null &&
      !['public', 'hidden'].includes(phase.visibility)
    ) {
      fail(`phases.${name}.visibility`, 'visibilité inconnue');
    }
    if (!phase.timeout) continue;
    if (!isGameDelay(phase.timeout.afterMs)) {
      fail(`phases.${name}.timeout`, 'durée invalide');
    }
    const action = phase.timeout.action?.type;
    if (!action || !actionNames.has(action)) {
      fail(
        `phases.${name}.timeout.action`,
        `action inconnue « ${String(action)} »`,
      );
    }
  }
  return names;
}

function assertEventDefinitions(
  events: NonNullable<DefinitionToValidate['events']>,
  fail: ValidationFailure,
): void {
  const names = new Set<string>();
  for (const event of events) {
    if (!event.type.trim()) fail('events.type', 'identifiant vide');
    if (names.has(event.type))
      fail('events', `événement dupliqué « ${event.type} »`);
    if (
      typeof event.data?.parse !== 'function' ||
      typeof event.emit !== 'function'
    ) {
      fail(`events.${event.type}`, 'utiliser defineEvent');
    }
    names.add(event.type);
  }
}

export type {
  DefinitionToValidate,
  ValidationFailure,
} from '../contracts/definition-validation';
