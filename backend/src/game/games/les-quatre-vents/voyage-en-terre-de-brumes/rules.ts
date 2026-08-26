import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import { VOYAGE_CONTENT } from './content';
import type {
  VoyageCard,
  VoyageCollection,
  VoyageCollectionKind,
  VoyagePendingChoice,
  VoyageState,
  VoyageTileType,
} from './state';

type RuleContext = GameRuleContext<VoyageState>;
const TRACK = 'ireland';
const COLLECTION_KINDS: VoyageCollectionKind[] = [
  'legend',
  'farce',
  'treasure',
  'landscape',
];

export const roll = defineAction<VoyageState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Lance le dé, avance avec rebond et résout la case atteinte.',
  execute: ({ state, actor, ctx }) => {
    const value = ctx.dice.roll('main').total;
    state.lastRoll = value;
    setPosition(actor.id, bounce(position(actor.id, ctx) + value), ctx);
    ctx.history.add(`${actor.username} lance le dé : « ${value} ».`);
    resolveLanding(state, actor.id, false, ctx);
    completeTurn(state, ctx);
  },
});

export const VOYAGE_ACTIONS = { roll };

export function resolveVoyageChoice(
  state: VoyageState,
  value: unknown,
  ctx: RuleContext,
): void {
  const pending = state.pendingChoice;
  if (!pending) throw new Error('Choix Voyage introuvable');
  state.pendingChoice = null;
  if (pending.kind === 'quiz') resolveQuiz(state, pending, String(value), ctx);
  else resolveTarget(state, pending, Number(value), ctx);
  completeTurn(state, ctx);
}

export function skipVoyagePlayer(state: VoyageState, ctx: RuleContext): void {
  const current = ctx.players.current();
  if (!current) return;
  state.skipTurns[current.id] = Math.max(0, state.skipTurns[current.id] - 1);
  ctx.history.add(`${current.username} passe son tour.`);
  completeTurn(state, ctx);
}

function resolveLanding(
  state: VoyageState,
  playerId: number,
  fromPassage: boolean,
  ctx: RuleContext,
): void {
  const tile = VOYAGE_CONTENT.tiles[position(playerId, ctx)];
  if (!tile) return;
  ctx.history.add(
    `${ctx.players.get(playerId)?.username ?? 'Le joueur'} atteint « ${tile.title} ».`,
  );
  if (tile.type === 'finish') {
    state.finishCountdown ??= ctx.players.all().length;
  } else if (tile.type === 'rest') {
    state.skipTurns[playerId] += 1;
  } else if (tile.type === 'passage' && !fromPassage) {
    if (/\béchange\b/i.test(tile.description ?? '')) {
      requestTarget(state, playerId, 'swap-position', 1, ctx);
    } else {
      const delta = extractMoveDelta(tile.description ?? '');
      if (delta !== 0) {
        setPosition(playerId, bounce(position(playerId, ctx) + delta), ctx);
        resolveLanding(state, playerId, true, ctx);
      }
    }
  } else if (isDeckTile(tile.type)) {
    drawAndApply(state, playerId, tile.type, ctx);
  }
}

function drawAndApply(
  state: VoyageState,
  playerId: number,
  deck: VoyageCollectionKind,
  ctx: RuleContext,
): void {
  const card = ctx.cards.drawOrRecycle<VoyageCard>(deck);
  if (!card) return;
  ctx.history.add(`Carte « ${card.title} ».`);
  if (deck === 'legend') {
    const quiz = parseQuiz(card);
    if (quiz) {
      state.pendingChoice = {
        kind: 'quiz',
        actorId: playerId,
        card,
        answer: quiz.answer,
        successDelta: quiz.successDelta,
      };
      ctx.choice.one({
        id: 'voyage.choice',
        player: playerId,
        options: quiz.choices,
      });
      return;
    }
    gain(state, playerId, deck);
  } else if (deck === 'treasure') {
    gain(state, playerId, deck);
  } else {
    const keep =
      deck === 'landscape'
        ? !/défauss/i.test(card.effect)
        : /gardez|conservez/i.test(card.effect);
    if (keep) gain(state, playerId, deck);
    else ctx.cards.discard(deck, card);
  }
  applyEffect(state, playerId, card.effect, ctx);
}

function applyEffect(
  state: VoyageState,
  playerId: number,
  text: string,
  ctx: RuleContext,
): void {
  if (
    /choisissez\s+un\s+joueur/i.test(text) &&
    /perd\s+son\s+prochain\s+tour/i.test(text)
  ) {
    requestTarget(state, playerId, 'skip-turn', 1, ctx);
    return;
  }
  if (/tirez\s+au\s+hasard\s+une\s+carte/i.test(text) && /perdez/i.test(text)) {
    const allowed = COLLECTION_KINDS.filter(
      (kind) =>
        !/l[ée]gende|paysage|tr[ée]sor|farce/i.test(text) ||
        new RegExp(kind === 'landscape' ? 'paysage' : kind, 'i').test(text),
    );
    loseRandomCard(state, playerId, allowed, ctx);
    return;
  }
  const delta = extractMoveDelta(text);
  if (delta !== 0) {
    setPosition(playerId, bounce(position(playerId, ctx) + delta), ctx);
    resolveLanding(state, playerId, false, ctx);
    return;
  }
  const skip = extractSkipTurns(text);
  if (skip > 0) {
    state.skipTurns[playerId] += skip;
    return;
  }
  if (/échange/i.test(text) && /carte/i.test(text)) {
    requestTarget(state, playerId, 'swap-card', extractCardCount(text), ctx);
    return;
  }
  if (/échange/i.test(text) && /position|place/i.test(text)) {
    if (/dernier\s+joueur/i.test(text)) {
      const target = otherPlayerIds(playerId, ctx).sort(
        (a, b) => position(a, ctx) - position(b, ctx),
      )[0];
      if (target != null) swapPositions(playerId, target, ctx);
      return;
    }
    requestTarget(state, playerId, 'swap-position', 1, ctx);
  }
}

function resolveQuiz(
  state: VoyageState,
  pending: Extract<VoyagePendingChoice, { kind: 'quiz' }>,
  answer: string,
  ctx: RuleContext,
): void {
  if (normalize(answer) !== normalize(pending.answer)) {
    ctx.cards.discard('legend', pending.card);
    ctx.history.add('Mauvaise réponse.');
    return;
  }
  ctx.history.add('Bonne réponse !');
  gain(state, pending.actorId, 'legend');
  if (pending.successDelta !== 0) {
    setPosition(
      pending.actorId,
      bounce(position(pending.actorId, ctx) + pending.successDelta),
      ctx,
    );
    resolveLanding(state, pending.actorId, false, ctx);
  }
}

function resolveTarget(
  state: VoyageState,
  pending: Extract<VoyagePendingChoice, { kind: 'target' }>,
  targetId: number,
  ctx: RuleContext,
): void {
  const allowed = targetOptions(state, pending.actorId, ctx);
  if (!allowed.includes(targetId)) throw new Error('Cible Voyage invalide');
  if (pending.effect === 'swap-position') {
    swapPositions(pending.actorId, targetId, ctx);
  } else if (pending.effect === 'skip-turn') {
    state.skipTurns[targetId] += 1;
  } else {
    exchangeRandomCards(state, pending.actorId, targetId, pending.count, ctx);
  }
  state.lastTargetByActor[pending.actorId] = targetId;
}

function requestTarget(
  state: VoyageState,
  actorId: number,
  effect: Extract<VoyagePendingChoice, { kind: 'target' }>['effect'],
  count: number,
  ctx: RuleContext,
): void {
  const options = targetOptions(state, actorId, ctx);
  if (options.length === 0) return;
  state.pendingChoice = { kind: 'target', actorId, effect, count };
  ctx.choice.one({
    id: 'voyage.choice',
    player: actorId,
    options,
    label: (targetId) =>
      ctx.players.get(targetId)?.username ?? String(targetId),
  });
}

function targetOptions(
  state: VoyageState,
  actorId: number,
  ctx: RuleContext,
): number[] {
  const last = state.lastTargetByActor[actorId];
  return otherPlayerIds(actorId, ctx).filter((id) => id !== last);
}

function exchangeRandomCards(
  state: VoyageState,
  firstId: number,
  secondId: number,
  count: number,
  ctx: RuleContext,
): void {
  for (let index = 0; index < count; index += 1) {
    const first = takeRandomKind(state.collections[firstId], ctx);
    const second = takeRandomKind(state.collections[secondId], ctx);
    if (first) state.collections[secondId][first] += 1;
    if (second) state.collections[firstId][second] += 1;
  }
}

function loseRandomCard(
  state: VoyageState,
  playerId: number,
  allowed: VoyageCollectionKind[],
  ctx: RuleContext,
): void {
  const choices = allowed.filter(
    (kind) => state.collections[playerId][kind] > 0,
  );
  const picked = ctx.random.pick(choices);
  if (picked) state.collections[playerId][picked] -= 1;
}

function takeRandomKind(
  collection: VoyageCollection,
  ctx: RuleContext,
): VoyageCollectionKind | null {
  const kind = ctx.random.pick(
    COLLECTION_KINDS.filter((candidate) => collection[candidate] > 0),
  );
  if (kind) collection[kind] -= 1;
  return kind;
}

function completeTurn(state: VoyageState, ctx: RuleContext): void {
  if (state.pendingChoice != null || state.winnerId != null) return;
  if (state.finishCountdown != null) {
    state.finishCountdown = Math.max(0, state.finishCountdown - 1);
    if (state.finishCountdown === 0) {
      const ranked = ctx.players
        .all()
        .map((player) => ({
          id: player.id,
          total: total(state.collections[player.id]),
          legends: state.collections[player.id].legend,
        }))
        .sort(
          (a, b) => b.total - a.total || b.legends - a.legends || a.id - b.id,
        );
      state.winnerId = ranked[0]?.id ?? null;
      return;
    }
  }
  ctx.turn.end();
}

function parseQuiz(
  card: VoyageCard,
): { choices: string[]; answer: string; successDelta: number } | null {
  const lines = card.effect
    .split(/\s*(?=[*]?[ABC]\))/i)
    .map((line) => line.trim())
    .filter((line) => /^[*]?[ABC]\)/i.test(line));
  const answerLine = lines.find((line) => line.startsWith('*'));
  if (lines.length < 2 || !answerLine) return null;
  const clean = (line: string) => line.replace(/^[*]?[ABC]\)\s*/i, '').trim();
  return {
    choices: lines.map(clean),
    answer: clean(answerLine),
    successDelta: extractMoveDelta(card.effect),
  };
}

function gain(
  state: VoyageState,
  playerId: number,
  kind: VoyageCollectionKind,
): void {
  state.collections[playerId][kind] += 1;
}

function total(collection: VoyageCollection): number {
  return COLLECTION_KINDS.reduce((sum, kind) => sum + collection[kind], 0);
}

function position(playerId: number, ctx: RuleContext): number {
  return ctx.movement.position(TRACK, playerId);
}

function setPosition(playerId: number, next: number, ctx: RuleContext): void {
  ctx.movement.move(TRACK, playerId, next - position(playerId, ctx));
}

function swapPositions(
  firstId: number,
  secondId: number,
  ctx: RuleContext,
): void {
  const first = position(firstId, ctx);
  const second = position(secondId, ctx);
  setPosition(firstId, second, ctx);
  setPosition(secondId, first, ctx);
}

function bounce(target: number): number {
  const last = VOYAGE_CONTENT.tiles.length - 1;
  if (target <= last) return Math.max(0, target);
  return Math.max(0, last - (target - last));
}

function otherPlayerIds(actorId: number, ctx: RuleContext): number[] {
  return ctx.players
    .all()
    .filter((player) => player.id !== actorId)
    .map((player) => player.id);
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('fr');
}

function isDeckTile(type: VoyageTileType): type is VoyageCollectionKind {
  return COLLECTION_KINDS.includes(type as VoyageCollectionKind);
}

function extractMoveDelta(text: string): number {
  const words: Record<string, number> = {
    un: 1,
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six: 6,
  };
  const match = text.match(
    /(avance(?:z)?|recule(?:z)?)\s+de\s+([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (!match) return 0;
  const amount = Number(match[2]) || words[match[2].toLowerCase()] || 0;
  return /^recule/i.test(match[1]) ? -amount : amount;
}

function extractSkipTurns(text: string): number {
  if (/passez trois tours/i.test(text)) return 3;
  if (/passez deux tours/i.test(text)) return 2;
  return /perdez votre prochain tour|passez votre tour|passe ton prochain tour/i.test(
    text,
  )
    ? 1
    : 0;
}

function extractCardCount(text: string): number {
  if (/\b3\b|\btrois\b/i.test(text)) return 3;
  return /\b2\b|\bdeux\b/i.test(text) ? 2 : 1;
}
