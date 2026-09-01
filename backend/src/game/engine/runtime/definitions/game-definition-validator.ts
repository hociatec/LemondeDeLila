import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import type { GameComponentDefinition } from './component-kit';
import { assertComponentDefinitions } from './game-definition-component-validator';
import {
  assertAuxiliaryDefinitions,
  assertConfiguration,
} from './game-definition-auxiliary-validator';

export type DefinitionToValidate = {
  id: string;
  players: { min: number; max: number };
  actions: Readonly<
    Record<string, { enumerateInputs?: unknown; validateInput?: unknown }>
  >;
  phases?: Readonly<
    Record<
      string,
      {
        actions?: readonly string[];
        next?: string;
        visibility?: string;
        timeout?: { afterMs?: number; action?: { type?: string } };
      }
    >
  >;
  initialPhase?: string;
  components?: readonly GameComponentDefinition[];
  automatic?: readonly { id: string; priority?: number }[];
  choices?: Readonly<Record<string, { input?: unknown }>>;
  events?: readonly {
    type: string;
    data?: { parse?: unknown };
    emit?: unknown;
  }[];
  stateVersion?: number;
  contentVersion?: string;
  rulesVersion?: string;
  config?: {
    input?: { parse?: unknown; describe?: unknown };
    defaults?: unknown;
    phase?: string;
    permission?: string;
  };
  content?: {
    kind?: unknown;
    gameId?: unknown;
    version?: unknown;
    data?: unknown;
  };
  effects?: Readonly<Record<string, { input?: unknown; resolveRaw?: unknown }>>;
};

export type ValidationFailure = (path: string, reason: string) => never;

export function assertGameDefinition(definition: DefinitionToValidate): void {
  const fail: ValidationFailure = (path, reason) => {
    throw new GameConfigurationError(
      `Définition ${definition.id || '<sans identifiant>'}.${path}: ${reason}`,
    );
  };
  assertMetadata(definition, fail);
  const actionNames = assertActionsAndEvents(definition, fail);
  const phaseNames = assertPhases(definition, actionNames, fail);
  assertComponentDefinitions(definition, fail);
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
    definition.players.max < definition.players.min
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
    if (version != null && version.trim().length === 0)
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
    if (
      !Number.isFinite(phase.timeout.afterMs) ||
      Number(phase.timeout.afterMs) < 0
    ) {
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
