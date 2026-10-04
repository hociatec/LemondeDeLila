import type { GameContext } from '../definitions/game-author-context';

type BattlePlay = { playerId: number; cardNames: string[] };

export function battleWonNarration(
  ctx: GameContext<Record<string, never>>,
  winnerId: number,
  cardsWon: number,
  plays: BattlePlay[],
) {
  const players = ctx.players.all();
  const playerName = (playerId: number, viewerId?: number) =>
    playerId === viewerId
      ? 'Vous'
      : (players.find((player) => player.id === playerId)?.username ??
        `Joueur ${playerId}`);
  const text = (viewerId?: number) => {
    const winner = playerName(winnerId, viewerId);
    const cards = `carte${cardsWon === 1 ? '' : 's'}`;
    const wasBattle = plays.some((play) => play.cardNames.length > 1);
    const result = wasBattle
      ? winner === 'Vous'
        ? `Vous gagnez la bataille et remportez ${cardsWon} ${cards}.`
        : `${winner} gagne la bataille et remporte ${cardsWon} ${cards}.`
      : winner === 'Vous'
        ? `Vous remportez le pli et gagnez ${cardsWon} ${cards}.`
        : `${winner} remporte le pli et gagne ${cardsWon} ${cards}.`;
    const revealed = plays
      .filter((play) => play.cardNames.length > 0)
      .map((play) => {
        const name = playerName(play.playerId, viewerId);
        return name === 'Vous'
          ? `Vous avez posé : ${play.cardNames.join(', ')}.`
          : `${name} a posé : ${play.cardNames.join(', ')}.`;
      });
    return [result, ...revealed].join(' ');
  };
  return {
    default: text(),
    byPlayerId: Object.fromEntries(
      players.map((player) => [player.id, text(player.id)]),
    ),
    supersedes: ['card.received'],
  };
}
