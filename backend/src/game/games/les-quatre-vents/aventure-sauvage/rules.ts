import {
  raceTurn,
  sequentialPawnSelection,
  setupPlayingPhases,
} from '../../../engine/sdk/public-api';
import type { GameContext } from '../../../engine/sdk/public-api';
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

export const requestPawn = pawnSelection.request;
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
        const card = ctx.cards.drawOrRecycle<AventureCard>(tile.type);
        if (!card) return;
        ctx.cards.discard(tile.type, card);
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
