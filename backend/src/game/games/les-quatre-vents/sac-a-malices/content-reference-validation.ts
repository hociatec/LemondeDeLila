import { isRecord, rejectContent } from '../../../engine/sdk/public-api';
import { movementInput } from './card-content';
import type { SacVariant } from './content-types';

export function assertSacReferences(variant: SacVariant): void {
  const fail = (reason: string): never =>
    rejectContent(`Références Sac ${variant.id} : ${reason}`);
  const tiles = new Map(variant.tiles.map((tile) => [tile.id, tile]));
  const groups = new Map(variant.groups.map((group) => [group.id, group]));
  if (
    tiles.size !== variant.tiles.length ||
    groups.size !== variant.groups.length
  )
    fail('identifiant dupliqué');
  if (
    variant.tiles[0]?.type !== 'start' ||
    tiles.get(variant.rules.jail.tileId)?.type !== 'jail'
  )
    fail('départ ou prison invalide');
  const grouped = new Set<string>();
  for (const group of variant.groups) {
    if (!group.propertyIds.length) fail('groupe vide');
    for (const id of group.propertyIds) {
      const tile = tiles.get(id);
      if (
        !tile ||
        tile.type !== 'property' ||
        tile.groupId !== group.id ||
        grouped.has(id)
      )
        fail('propriété de groupe invalide');
      grouped.add(id);
    }
  }
  for (const tile of variant.tiles) {
    if (
      tile.type === 'property' &&
      (!tile.groupId || !groups.has(tile.groupId) || !grouped.has(tile.id))
    )
      fail('propriété sans groupe');
    if (tile.type !== 'property' && tile.groupId !== undefined)
      fail('groupe sur une case non immobilière');
  }
  const stations = new Set(variant.stations.propertyIds);
  if (
    stations.size !== variant.stations.propertyIds.length ||
    stations.size !==
      variant.tiles.filter((tile) => tile.type === 'station').length ||
    [...stations].some((id) => tiles.get(id)?.type !== 'station')
  )
    fail('gare inconnue ou dupliquée');
  const utilities = new Set(variant.utilities.map((utility) => utility.tileId));
  if (
    utilities.size !== variant.utilities.length ||
    utilities.size !==
      variant.tiles.filter((tile) => tile.type === 'utility').length ||
    [...utilities].some((id) => tiles.get(id)?.type !== 'utility')
  )
    fail('équipement inconnu ou dupliqué');
  for (const card of [...variant.chance, ...variant.community]) {
    for (const effect of card.effects) {
      if (effect.kind !== 'custom' || effect.effectId !== 'sac.movement')
        continue;
      if (!isRecord(effect.data)) return fail('déplacement invalide');
      const movement = movementInput.parse(effect.data.movement);
      if (movement.kind === 'tile' && !tiles.has(movement.tileId))
        fail('destination inconnue');
      if (movement.kind === 'next-group' && !groups.has(movement.groupId))
        fail('groupe de destination inconnu');
      if (movement.kind === 'next-station' && !stations.size)
        fail('aucune gare');
      if (
        movement.kind === 'next-community' &&
        !variant.tiles.some((tile) => tile.type === 'community')
      )
        fail('aucune case communauté');
      if (
        movement.kind === 'previous-chance' &&
        !variant.tiles.some((tile) => tile.type === 'chance')
      )
        fail('aucune case chance');
    }
  }
}
