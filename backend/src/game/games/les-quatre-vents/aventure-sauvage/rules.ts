import type { GameContext } from '../../../engine/sdk/public-api';
import {
  drawEvent,
  defineChoice,
  defineEffect,
  gameInput,
  raceTurn,
  sequentialPawnSelection,
  setupPlayingPhases,
} from '../../../engine/sdk/public-api';
import { AVENTURE_TILES } from './content';
import type { AventureCard, AventureSauvageState } from './types';

type RuleContext = GameContext<AventureSauvageState>;
export const AVENTURE_PHASES = setupPlayingPhases<AventureSauvageState>();
const TRACK = 'jungle';

export const roll = raceTurn<AventureSauvageState>({
  trackId: TRACK,
  documentation: 'Lance le dé et résout immédiatement la case de jungle.',
  available: ({ ctx }) => AVENTURE_PHASES.is(ctx, 'playing'),
  resolveLanding: ({ playerId, ctx }) => {
    resolveAventureTile(playerId, ctx);
  },
});

export const AVENTURE_ACTIONS = { roll };

const pawnSelection = sequentialPawnSelection<AventureSauvageState>({
  setId: 'avatars',
  choiceId: 'aventure.pawn',
  complete: ({ ctx }) => {
    AVENTURE_PHASES.transition(ctx, 'playing');
    const first = ctx.players.all()[0];
    if (first) ctx.turn.to(first.id);
  },
});

export const setupGame = pawnSelection.setup(() => ({}));
export const resolvePawnChoice = pawnSelection.resolve;

export function resolveAventureTile(playerId: number, ctx: RuleContext): void {
  ctx.movement.resolveLanding({
    trackId: TRACK,
    playerId,
    tiles: AVENTURE_TILES,
    blocked: () => ctx.match.lifecycle() === 'finished',
    onLand: ({ position, tile }) => {
      if (!tile) return;
      ctx.events.message('game.pawn.landed', { playerId, tileId: position });
      if (tile.type === 'animal' || tile.type === 'patte') {
        const card = drawEvent<AventureSauvageState, AventureCard>(ctx, {
          deckId: tile.type,
          playerId: playerId,
          recycle: true,
          discard: true,
        });
        if (!card) return;

        applyCard(playerId, card, ctx);
      }
    },
  });
}

function applyCard(
  playerId: number,
  card: AventureCard,
  ctx: RuleContext,
): void {
  ctx.events.message('game.card.drawn', {
    playerId,
    deckId: card.deck,
    cardId: card.id,
  });
  ctx.effects.schedule(...card.effects);
}

export const GAME_CHOICES = {
  'aventure.pawn': defineChoice<AventureSauvageState, string>({
    input: gameInput.string({ min: 1, max: 128 }),
    resolve: ({ actor, value, ctx }) => resolvePawnChoice(actor.id, value, ctx),
  }),
};

export const GAME_EFFECTS = {
  'aventure.resolve-landing': defineEffect<
    AventureSauvageState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, ctx }) => {
      if (actorPlayerId != null) resolveAventureTile(actorPlayerId, ctx);
    },
  }),
};
