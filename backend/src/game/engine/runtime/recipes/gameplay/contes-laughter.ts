export function contesLaughterWinners(
  order: readonly number[],
  picks: Readonly<Record<number, number>>,
) {
  const maximum = Math.max(...Object.values(picks));
  return order.filter((id) => picks[id] === maximum);
}
