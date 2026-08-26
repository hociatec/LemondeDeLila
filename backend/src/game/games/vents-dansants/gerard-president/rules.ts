import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import {
  GERARD_PRESIDENT_SPECIAL_CARDS,
  type GerardPresidentSpecialCard,
} from './content';
import type { GerardState } from './state';

const NAME_HANDS = 'names';
const SPECIAL_HANDS = 'specials';
type RuleContext = GameRuleContext<GerardState>;
type SpecialInput = {
  cardId: string;
  targetPlayerId?: number;
  secondaryTargetId?: number;
  name?: string;
};

export const setTheme = defineAction<GerardState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Le maître pioche et révèle le prochain thème.',
  available: ({ state, actor }) =>
    state.phase === 'waiting-theme' && state.masterId === actor.id,
  execute: ({ state, actor, ctx }) => {
    if (state.phase !== 'waiting-theme' || state.masterId !== actor.id) {
      throw new Error('Seul le maître peut révéler le thème');
    }
    const theme = ctx.cards.drawOrRecycle<string>('themes');
    if (!theme) throw new Error('Plus aucun thème disponible');
    state.currentTheme = theme;
    state.secondTheme = null;
    state.themeSecretActive = false;
    state.submissions = {};
    state.pendingPlayers = ctx.players
      .all()
      .filter((player) => player.id !== actor.id)
      .map((player) => player.id);
    state.phase = state.pendingPlayers.length
      ? 'collecting-names'
      : 'choosing-winner';
    state.roundNumber += 1;
    state.juryOverrideId = null;
    state.ghostNames = [];
    state.specialAttackers = {};
    ctx.transitionTo(state.phase);
    ctx.turn.to(state.pendingPlayers[0] ?? actor.id);
  },
});

export const playName = defineAction<GerardState, { names: string[] }>({
  input: gameInput.object({
    names: gameInput.array(gameInput.string({ min: 1, max: 80 }), {
      min: 1,
      max: 3,
    }),
  }),
  documentation: 'Soumet secrètement un à trois prénoms autorisés.',
  available: ({ state, actor }) =>
    state.phase === 'collecting-names' && state.pendingPlayers[0] === actor.id,
  availableInputs: ({ state, actor, ctx }) => {
    if (state.pendingPlayers[0] !== actor.id) return [];
    const allowed = Math.min(3, 1 + (state.extraNamesAllowed[actor.id] ?? 0));
    const hand = ctx.cards
      .hand<string>(NAME_HANDS, actor.id)
      .filter((name) => name !== state.lockedName);
    return combinations(hand, allowed).map((names) => ({ names }));
  },
  execute: ({ state, actor, input, ctx }) => {
    const allowed = Math.min(3, 1 + (state.extraNamesAllowed[actor.id] ?? 0));
    const distinct = [...new Set(input.names)];
    const hand = ctx.cards.hand<string>(NAME_HANDS, actor.id);
    if (
      distinct.length !== input.names.length ||
      distinct.length > allowed ||
      distinct.includes(state.lockedName ?? '') ||
      !distinct.every((name) => hand.includes(name))
    ) {
      throw new Error('Soumission de prénoms invalide');
    }
    for (const name of distinct) ctx.cards.take(NAME_HANDS, actor.id, name);
    state.submissions[actor.id] = distinct;
    state.extraNamesAllowed[actor.id] = 0;
    advanceSubmission(state, actor.id, ctx);
  },
});

export const playSpecial = defineAction<GerardState, SpecialInput>({
  input: gameInput.object({
    cardId: gameInput.cardId(),
    targetPlayerId: gameInput.optional(gameInput.playerId()),
    secondaryTargetId: gameInput.optional(gameInput.playerId()),
    name: gameInput.optional(gameInput.string({ min: 1, max: 80 })),
  }),
  documentation: 'Joue une carte spéciale et applique son effet immédiatement.',
  available: ({ state }) => state.phase !== 'choosing-winner',
  availableInputs: ({ state, actor, ctx }) =>
    ctx.cards
      .hand<string>(SPECIAL_HANDS, actor.id)
      .flatMap((cardId) => specialInputs(state, actor.id, cardId, ctx)),
  execute: ({ state, actor, input, ctx }) => {
    const card = GERARD_PRESIDENT_SPECIAL_CARDS.find(
      (candidate) => candidate.id === input.cardId,
    );
    if (
      !card ||
      !ctx.cards.hand<string>(SPECIAL_HANDS, actor.id).includes(card.id)
    ) {
      throw new Error('Carte spéciale absente de la main');
    }
    validateTargets(actor.id, input, ctx);
    ctx.cards.play(SPECIAL_HANDS, 'specials', actor.id, card.id);
    applySpecial(state, actor.id, card, input, ctx);
    syncTurn(state, ctx);
  },
});

export const chooseWinner = defineAction<GerardState, { winnerId: number }>({
  input: gameInput.object({ winnerId: gameInput.playerId() }),
  documentation: 'Le jury attribue la manche à une soumission révélée.',
  available: ({ state, actor }) =>
    state.phase === 'choosing-winner' && juryId(state) === actor.id,
  availableInputs: ({ state, actor }) =>
    state.phase === 'choosing-winner' && juryId(state) === actor.id
      ? Object.keys(state.submissions).map((winnerId) => ({
          winnerId: Number(winnerId),
        }))
      : [],
  execute: ({ state, actor, input, ctx }) => {
    if (state.phase !== 'choosing-winner' || juryId(state) !== actor.id) {
      throw new Error('Ce joueur ne fait pas partie du jury');
    }
    if (!state.submissions[input.winnerId]) {
      throw new Error('Le gagnant doit avoir soumis un prénom');
    }
    state.scores[input.winnerId] += 1;
    if (state.scores[input.winnerId] >= state.targetScore) {
      state.winnerId = input.winnerId;
      return;
    }
    closeRound(state, ctx);
  },
});

export const pass = defineAction<GerardState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Passe pendant la collecte des prénoms.',
  available: ({ state, actor }) =>
    state.phase === 'collecting-names' && state.pendingPlayers[0] === actor.id,
  execute: ({ state, actor, ctx }) => advanceSubmission(state, actor.id, ctx),
});

export const GERARD_ACTIONS = {
  set_theme: setTheme,
  play_name: playName,
  play_special: playSpecial,
  choose_winner: chooseWinner,
  pass,
};

function applySpecial(
  state: GerardState,
  actorId: number,
  card: GerardPresidentSpecialCard,
  input: SpecialInput,
  ctx: RuleContext,
): void {
  const target = input.targetPlayerId ?? null;
  const secondary = input.secondaryTargetId ?? null;
  const defended = target != null && consumeDefense(state, target);
  if (target != null) {
    state.specialAttackers[target] = [
      ...(state.specialAttackers[target] ?? []),
      actorId,
    ];
  }
  if (defended && isAttack(card.effect)) return;
  if (card.effect === 'double-prenom') state.extraNamesAllowed[actorId] = 1;
  else if (card.effect === 'mega-combo') state.extraNamesAllowed[actorId] = 2;
  else if (card.effect === 'double-theme') {
    state.secondTheme = ctx.cards.drawOrRecycle<string>('themes');
  } else if (card.effect === 'interdiction')
    state.lockedName = input.name ?? null;
  else if (card.effect === 'defense-totale')
    state.defenseActive[actorId] = true;
  else if (card.effect === 'main-fantome' && target != null) {
    const name = takeRandomName(target, ctx);
    if (name) state.submissions[target] = [name];
    state.pendingPlayers = state.pendingPlayers.filter((id) => id !== target);
    updateCollectionPhase(state, ctx);
  } else if (card.effect === 'echange-force' && target != null) {
    exchangeRandomNames(actorId, target, ctx);
  } else if (card.effect === 'panique-generale') {
    for (const player of ctx.players.all()) redrawNames(player.id, 3, ctx);
  } else if (card.effect === 'sabotage' && target != null) {
    discardRandomName(target, ctx);
  } else if (card.effect === 'retour-envoyeur') {
    const attacker = state.specialAttackers[actorId]?.shift();
    if (attacker != null) discardRandomName(attacker, ctx);
  } else if (card.effect === 'theme-secret') state.themeSecretActive = true;
  else if (card.effect === 'chuchotement-confus' && target != null) {
    const neighbor = nextPlayerId(target, ctx);
    if (neighbor != null) exchangeRandomNames(target, neighbor, ctx);
  } else if (card.effect === 'inversion') state.pendingPlayers.reverse();
  else if (card.effect === 'jury-mystere') {
    state.juryOverrideId =
      target ?? ctx.random.pick(otherPlayerIds(actorId, ctx));
  } else if (card.effect === 'effet-domino') {
    for (const playerId of state.pendingPlayers)
      state.extraNamesAllowed[playerId] += 1;
  } else if (card.effect === 'prenom-fantome')
    state.ghostNames.push('Prénom Fantôme');
  else if (card.effect === 'inversion-role') state.masterId = actorId;
  else if (card.effect === 'chaos-temporel') {
    discardSubmissions(state, ctx);
    state.submissions = {};
    state.pendingPlayers = otherPlayerIds(state.masterId, ctx);
    updateCollectionPhase(state, ctx);
  } else if (card.effect === 'ultra-sabotage') {
    if (target != null) discardRandomName(target, ctx);
    if (secondary != null && secondary !== target)
      discardRandomName(secondary, ctx);
  } else if (card.effect === 'prenom-volant' && target != null) {
    const name = takeRandomName(target, ctx);
    if (name) ctx.cards.give(NAME_HANDS, actorId, name);
  }
}

function advanceSubmission(
  state: GerardState,
  actorId: number,
  ctx: RuleContext,
): void {
  if (state.pendingPlayers[0] !== actorId)
    throw new Error('Ordre de jeu invalide');
  state.pendingPlayers.shift();
  updateCollectionPhase(state, ctx);
}

function updateCollectionPhase(state: GerardState, ctx: RuleContext): void {
  state.phase = state.pendingPlayers.length
    ? 'collecting-names'
    : 'choosing-winner';
  ctx.transitionTo(state.phase);
  syncTurn(state, ctx);
}

function syncTurn(state: GerardState, ctx: RuleContext): void {
  const next =
    state.phase === 'collecting-names'
      ? state.pendingPlayers[0]
      : state.phase === 'choosing-winner'
        ? juryId(state)
        : state.masterId;
  if (next != null) ctx.turn.to(next);
}

function closeRound(state: GerardState, ctx: RuleContext): void {
  discardSubmissions(state, ctx);
  if (state.currentTheme) ctx.cards.discard('themes', state.currentTheme);
  if (state.secondTheme) ctx.cards.discard('themes', state.secondTheme);
  for (const player of ctx.players.all()) {
    refillHand(NAME_HANDS, 'names', player.id, 10, ctx);
    refillHand(SPECIAL_HANDS, 'specials', player.id, 2, ctx);
  }
  state.masterId = nextPlayerId(state.masterId, ctx) ?? state.masterId;
  state.currentTheme = null;
  state.secondTheme = null;
  state.lockedName = null;
  state.submissions = {};
  state.pendingPlayers = [];
  state.phase = 'waiting-theme';
  state.extraNamesAllowed = zeroByPlayer(ctx);
  state.defenseActive = falseByPlayer(ctx);
  state.specialAttackers = {};
  state.themeSecretActive = false;
  state.juryOverrideId = null;
  state.ghostNames = [];
  ctx.transitionTo('waiting-theme');
  ctx.turn.to(state.masterId);
}

function discardSubmissions(state: GerardState, ctx: RuleContext): void {
  for (const name of [
    ...Object.values(state.submissions).flat(),
    ...state.ghostNames,
  ]) {
    ctx.cards.discard('names', name);
  }
}

function takeRandomName(playerId: number, ctx: RuleContext): string | null {
  const hand = ctx.cards.hand<string>(NAME_HANDS, playerId);
  const name = ctx.random.pick(hand);
  return name ? ctx.cards.take(NAME_HANDS, playerId, name) : null;
}

function discardRandomName(playerId: number, ctx: RuleContext): void {
  const name = takeRandomName(playerId, ctx);
  if (name) ctx.cards.discard('names', name);
}

function exchangeRandomNames(
  first: number,
  second: number,
  ctx: RuleContext,
): void {
  const firstName = takeRandomName(first, ctx);
  const secondName = takeRandomName(second, ctx);
  if (firstName) ctx.cards.give(NAME_HANDS, second, firstName);
  if (secondName) ctx.cards.give(NAME_HANDS, first, secondName);
}

function redrawNames(playerId: number, count: number, ctx: RuleContext): void {
  for (let index = 0; index < count; index += 1)
    discardRandomName(playerId, ctx);
  refillHand(NAME_HANDS, 'names', playerId, 10, ctx);
}

function refillHand(
  handId: string,
  deckId: string,
  playerId: number,
  target: number,
  ctx: RuleContext,
): void {
  const hand = ctx.cards.hand<string>(handId, playerId);
  while (hand.length < target) {
    const card = ctx.cards.drawOrRecycle<string>(deckId);
    if (!card) return;
    ctx.cards.give(handId, playerId, card);
  }
}

function specialInputs(
  state: GerardState,
  actorId: number,
  cardId: string,
  ctx: RuleContext,
): SpecialInput[] {
  const effect = GERARD_PRESIDENT_SPECIAL_CARDS.find(
    (card) => card.id === cardId,
  )?.effect;
  if (effect === 'interdiction') {
    return ctx.cards
      .hand<string>(NAME_HANDS, actorId)
      .map((name) => ({ cardId, name }));
  }
  const targeted = [
    'sabotage',
    'main-fantome',
    'echange-force',
    'chuchotement-confus',
    'jury-mystere',
    'prenom-volant',
    'ultra-sabotage',
  ].includes(effect ?? '');
  const targets = targeted ? otherPlayerIds(actorId, ctx) : [];
  if (effect === 'ultra-sabotage') {
    return targets.flatMap((targetPlayerId, index) =>
      targets.slice(index + 1).map((secondaryTargetId) => ({
        cardId,
        targetPlayerId,
        secondaryTargetId,
      })),
    );
  }
  return targeted
    ? targets.map((targetPlayerId) => ({ cardId, targetPlayerId }))
    : [{ cardId }];
}

function validateTargets(
  actorId: number,
  input: SpecialInput,
  ctx: RuleContext,
): void {
  for (const target of [input.targetPlayerId, input.secondaryTargetId]) {
    if (target != null && (target === actorId || !ctx.players.get(target))) {
      throw new Error('Cible Gérard invalide');
    }
  }
}

function combinations(values: string[], maximum: number): string[][] {
  const result: string[][] = [];
  const visit = (start: number, selected: string[]) => {
    if (selected.length > 0) result.push([...selected]);
    if (selected.length === maximum) return;
    for (let index = start; index < values.length; index += 1) {
      selected.push(values[index]);
      visit(index + 1, selected);
      selected.pop();
    }
  };
  visit(0, []);
  return result;
}

function consumeDefense(state: GerardState, playerId: number): boolean {
  if (!state.defenseActive[playerId]) return false;
  state.defenseActive[playerId] = false;
  return true;
}

function isAttack(effect: string): boolean {
  return ['sabotage', 'ultra-sabotage', 'main-fantome'].includes(effect);
}

function juryId(state: GerardState): number {
  return state.juryOverrideId ?? state.masterId;
}

function nextPlayerId(playerId: number, ctx: RuleContext): number | null {
  const ids = ctx.players.all().map((player) => player.id);
  const index = ids.indexOf(playerId);
  return ids.length ? ids[(index + 1 + ids.length) % ids.length] : null;
}

function otherPlayerIds(actorId: number, ctx: RuleContext): number[] {
  return ctx.players
    .all()
    .filter((player) => player.id !== actorId)
    .map((player) => player.id);
}

export function zeroByPlayer(ctx: RuleContext): Record<number, number> {
  return Object.fromEntries(ctx.players.all().map((player) => [player.id, 0]));
}

export function falseByPlayer(ctx: RuleContext): Record<number, boolean> {
  return Object.fromEntries(
    ctx.players.all().map((player) => [player.id, false]),
  );
}
