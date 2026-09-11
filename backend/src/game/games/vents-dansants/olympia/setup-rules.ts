import type {
  GameContext,
  NoGameState as OlympiaState,
} from '../../../engine/sdk/public-api';
export const setupGame = ({
  players,
  ctx,
}: {
  ctx: GameContext<OlympiaState>;
  players: ReturnType<GameContext<OlympiaState>['players']['all']>;
}): OlympiaState => {
  for (const player of players) {
    const divinity = ctx.cards.draw<string>('divinite');
    if (divinity) ctx.cards.give('divinities', player.id, divinity);
    for (let index = 0; index < 2; index += 1) {
      const creature = ctx.cards.draw<string>('creatures');
      if (creature) ctx.cards.give('players', player.id, creature);
    }
    const action =
      ctx.cards.draw<string>('actions') ?? ctx.cards.draw<string>('attaques');
    if (action) ctx.cards.give('players', player.id, action);
  }
  return {};
};
