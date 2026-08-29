import { GameConfigurationError } from '../../../domain/errors/game-domain.errors';
import type { GameComponentDefinition } from './component-kit';
import type { GameEffectInstruction } from '../effects/effects-kit';
import { assertEffectInstructions } from '../effects/game-effect-definition-validator';

type DefinitionToValidate = {
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
  stateVersion?: number;
  contentVersion?: string;
  rulesVersion?: string;
  migrations?: readonly { from: number; to: number }[];
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

export function assertGameDefinition(definition: DefinitionToValidate): void {
  const fail = (path: string, reason: string): never => {
    throw new GameConfigurationError(
      `Définition ${definition.id || '<sans identifiant>'}.${path}: ${reason}`,
    );
  };

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(definition.id)) {
    fail('id', 'format invalide');
  }
  if (
    !Number.isInteger(definition.players.min) ||
    !Number.isInteger(definition.players.max) ||
    definition.players.min < 1 ||
    definition.players.max < definition.players.min
  ) {
    fail('players', 'limites de joueurs invalides');
  }
  if (
    definition.stateVersion != null &&
    (!Number.isInteger(definition.stateVersion) || definition.stateVersion < 1)
  ) {
    fail('stateVersion', 'un entier positif est requis');
  }
  if (
    definition.rulesVersion != null &&
    definition.rulesVersion.trim().length === 0
  ) {
    fail('rulesVersion', 'la version des règles ne peut pas être vide');
  }
  if (
    definition.contentVersion != null &&
    definition.contentVersion.trim().length === 0
  ) {
    fail('contentVersion', 'la version du contenu ne peut pas être vide');
  }
  if (definition.content) {
    if (definition.content.kind !== 'lila.game-content') {
      fail('content.kind', 'utiliser defineGameContent');
    }
    if (definition.content.gameId !== definition.id) {
      fail(
        'content.gameId',
        `identifiant « ${String(definition.content.gameId)} » différent du jeu`,
      );
    }
    if (
      typeof definition.content.version !== 'string' ||
      definition.content.version.trim().length === 0
    ) {
      fail('content.version', 'version de contenu requise');
    }
    if (
      definition.content.data == null ||
      typeof definition.content.data !== 'object' ||
      !Object.isFrozen(definition.content) ||
      !Object.isFrozen(definition.content.data)
    ) {
      fail('content', 'le contenu statique doit être immuable');
    }
  }

  const actionNames = new Set(Object.keys(definition.actions));
  if (actionNames.size === 0) {
    fail('actions', 'au moins une action est requise');
  }
  for (const [actionName, action] of Object.entries(definition.actions)) {
    if (
      action.enumerateInputs != null &&
      typeof action.validateInput !== 'function'
    ) {
      fail(
        `actions.${actionName}.validate`,
        'une action énumérée doit déclarer une validation serveur',
      );
    }
  }

  const phaseNames = new Set(Object.keys(definition.phases ?? {}));
  if (
    phaseNames.size > 0 &&
    definition.initialPhase &&
    !phaseNames.has(definition.initialPhase)
  ) {
    fail('initialPhase', `phase inconnue « ${definition.initialPhase} »`);
  }
  for (const [phaseName, phase] of Object.entries(definition.phases ?? {})) {
    for (const actionName of phase.actions ?? []) {
      if (!actionNames.has(actionName)) {
        fail(
          `phases.${phaseName}.actions`,
          `action inconnue « ${actionName} »`,
        );
      }
    }
    if (phase.next && !phaseNames.has(phase.next)) {
      fail(`phases.${phaseName}.next`, `phase inconnue « ${phase.next} »`);
    }
    if (
      phase.visibility != null &&
      !['public', 'hidden'].includes(phase.visibility)
    ) {
      fail(`phases.${phaseName}.visibility`, 'visibilité inconnue');
    }
    if (phase.timeout) {
      if (
        !Number.isFinite(phase.timeout.afterMs) ||
        Number(phase.timeout.afterMs) < 0
      ) {
        fail(`phases.${phaseName}.timeout`, 'durée invalide');
      }
      const timeoutAction = phase.timeout.action?.type;
      if (!timeoutAction || !actionNames.has(timeoutAction)) {
        fail(
          `phases.${phaseName}.timeout.action`,
          `action inconnue « ${String(timeoutAction)} »`,
        );
      }
    }
  }

  const componentKeys = new Set<string>();
  const decks = new Map<
    string,
    Extract<GameComponentDefinition, { component: 'cards.deck' }>
  >();
  const hands = new Map<
    string,
    Extract<GameComponentDefinition, { component: 'cards.hands' }>
  >();
  const inventories = new Map<
    string,
    Extract<GameComponentDefinition, { component: 'inventory.set' }>
  >();
  const tracks = new Set<string>();
  const diceSets = new Set<string>();
  for (const component of definition.components ?? []) {
    const id = 'id' in component ? component.id : undefined;
    if (typeof id !== 'string' || id.trim().length === 0) {
      fail(
        'components',
        `identifiant manquant pour « ${component.component} »`,
      );
    }
    const key = `${component.component}:${id}`;
    if (componentKeys.has(key)) {
      fail('components', `composant dupliqué « ${key} »`);
    }
    componentKeys.add(key);
    if (component.component === 'cards.deck')
      decks.set(component.id, component);
    if (component.component === 'cards.hands')
      hands.set(component.id, component);
    if (component.component === 'inventory.set') {
      inventories.set(component.id, component);
    }
    if (component.component === 'movement.track') tracks.add(component.id);
    if (component.component === 'dice.set') diceSets.add(component.id);
  }
  const effectReferences = {
    decks,
    hands,
    inventories,
    tracks,
    diceSets,
    effects: definition.effects,
  };
  for (const component of definition.components ?? []) {
    if (component.component === 'cards.hands' && !decks.has(component.deck)) {
      fail(
        `components.${component.id}.deck`,
        `pioche inconnue « ${component.deck} »`,
      );
    }
    if (component.component === 'cards.sets') {
      const hand = hands.get(component.hand);
      const deck = decks.get(component.deck);
      if (!hand) {
        fail(
          `components.${component.id}.hand`,
          `main inconnue « ${component.hand} »`,
        );
      }
      if (!deck) {
        fail(
          `components.${component.id}.deck`,
          `pioche inconnue « ${component.deck} »`,
        );
      }
      if (hand && hand.deck !== component.deck) {
        fail(
          `components.${component.id}`,
          `la main « ${component.hand} » dépend de la pioche « ${hand.deck} »`,
        );
      }
      const cardIds = new Set(
        (deck?.cards ?? []).flatMap((card) => {
          if (typeof card === 'string') return [card];
          if (
            card != null &&
            typeof card === 'object' &&
            'id' in card &&
            typeof card.id === 'string'
          ) {
            return [card.id];
          }
          return [];
        }),
      );
      for (const [setId, setCardIds] of Object.entries(component.sets)) {
        if (setCardIds.length === 0) {
          fail(`components.${component.id}.sets.${setId}`, 'famille vide');
        }
        if (
          cardIds.size > 0 &&
          setCardIds.some((cardId) => !cardIds.has(cardId))
        ) {
          fail(
            `components.${component.id}.sets.${setId}`,
            'référence une carte absente de la pioche',
          );
        }
      }
    }
    if (component.component === 'economy.market') {
      const inventory = inventories.get(component.inventory);
      if (!inventory) {
        fail(
          `components.${component.id}.inventory`,
          `inventaire inconnu « ${component.inventory} »`,
        );
      }
      if (
        inventory?.items &&
        Object.keys(component.prices).some(
          (itemId) => !inventory.items?.includes(itemId),
        )
      ) {
        fail(
          `components.${component.id}.prices`,
          'référence un objet absent de l’inventaire',
        );
      }
    }
    if (component.component === 'movement.track') {
      for (const [position, instructions] of Object.entries(
        component.landingEffects ?? {},
      )) {
        assertEffectInstructions(
          instructions,
          `components.${component.id}.landingEffects.${position}`,
          effectReferences,
          fail,
        );
      }
    }
    if (component.component === 'cards.deck') {
      for (const [index, card] of component.cards.entries()) {
        if (
          card != null &&
          typeof card === 'object' &&
          'effects' in card &&
          Array.isArray(card.effects)
        ) {
          assertEffectInstructions(
            card.effects as readonly GameEffectInstruction[],
            `components.${component.id}.cards.${index}.effects`,
            effectReferences,
            fail,
          );
        }
      }
    }
  }

  const automaticIds = new Set<string>();
  for (const automatic of definition.automatic ?? []) {
    if (!automatic.id.trim()) {
      fail('automatic', 'identifiant de règle automatique vide');
    }
    if (automaticIds.has(automatic.id)) {
      fail('automatic', `règle dupliquée « ${automatic.id} »`);
    }
    if (automatic.priority != null && !Number.isFinite(automatic.priority)) {
      fail(
        `automatic.${automatic.id}.priority`,
        'la priorité doit être un nombre fini',
      );
    }
    automaticIds.add(automatic.id);
  }

  for (const [choiceId, choice] of Object.entries(definition.choices ?? {})) {
    if (!choice.input || typeof choice.input !== 'object') {
      fail(`choices.${choiceId}.input`, 'un schéma de valeur est requis');
    }
  }
  for (const [effectId, effect] of Object.entries(definition.effects ?? {})) {
    if (!effectId.trim()) fail('effects', 'identifiant d’effet vide');
    if (!effect.input || typeof effect.input !== 'object') {
      fail(`effects.${effectId}.input`, 'un schéma de données est requis');
    }
    if (typeof effect.resolveRaw !== 'function') {
      fail(`effects.${effectId}.resolveRaw`, 'un resolver est requis');
    }
  }

  if (definition.config) {
    if (
      typeof definition.config.input?.parse !== 'function' ||
      typeof definition.config.input.describe !== 'function'
    ) {
      fail('config.input', 'un schéma de configuration est requis');
    }
    if (
      definition.config.defaults == null ||
      typeof definition.config.defaults !== 'object' ||
      Array.isArray(definition.config.defaults)
    ) {
      fail('config.defaults', 'un objet de valeurs par défaut est requis');
    }
    if (
      phaseNames.size > 0 &&
      definition.config.phase &&
      !phaseNames.has(definition.config.phase)
    ) {
      fail('config.phase', `phase inconnue « ${definition.config.phase} »`);
    }
    if (
      definition.config.permission != null &&
      !['owner', 'any-player'].includes(definition.config.permission)
    ) {
      fail('config.permission', 'permission inconnue');
    }
  }

  const targetVersion = definition.stateVersion ?? 1;
  const migrationsBySource = new Map<number, number>();
  for (const migration of definition.migrations ?? []) {
    if (
      !Number.isInteger(migration.from) ||
      !Number.isInteger(migration.to) ||
      migration.from < 1 ||
      migration.to <= migration.from ||
      migration.to > targetVersion
    ) {
      fail(
        'migrations',
        `transition invalide ${migration.from}→${migration.to}`,
      );
    }
    if (migrationsBySource.has(migration.from)) {
      fail('migrations', `source dupliquée « ${migration.from} »`);
    }
    migrationsBySource.set(migration.from, migration.to);
  }
  if (targetVersion > 1) {
    let cursor = 1;
    const visited = new Set<number>();
    while (cursor < targetVersion && !visited.has(cursor)) {
      visited.add(cursor);
      cursor = migrationsBySource.get(cursor) ?? 0;
    }
    if (cursor !== targetVersion) {
      fail('migrations', `chaîne incomplète de 1 vers ${targetVersion}`);
    }
  }
}
