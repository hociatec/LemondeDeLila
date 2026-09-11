import type {
  GameComponentDefinition,
  GameInitialization,
} from './component-kit';
import type { ValidationFailure } from '../contracts/definition-validation';

export function assertInitializationReferences(
  components: readonly GameComponentDefinition[],
  initialization: GameInitialization | undefined,
  fail: ValidationFailure,
): void {
  const tracks = new Set(
    components
      .filter((value) => value.component === 'movement.track')
      .map((value) => value.id),
  );
  const pawns = new Set(
    components
      .filter((value) => value.component === 'pawn.set')
      .map((value) => value.id),
  );
  const inventories = new Set(
    components
      .filter((value) => value.component === 'inventory.set')
      .map((value) => value.id),
  );
  for (const [id, positions] of Object.entries(initialization?.tracks ?? {})) {
    if (!tracks.has(id)) fail(`initialization.tracks.${id}`, 'piste inconnue');
    const track = components.find(
      (value) => value.component === 'movement.track' && value.id === id,
    );
    if (track?.component === 'movement.track') {
      for (const position of typeof positions === 'number'
        ? [positions]
        : Object.values(positions)) {
        if (
          !Number.isSafeInteger(position) ||
          position < 0 ||
          position >= track.spaces
        )
          fail(`initialization.tracks.${id}`, 'case inexistante');
      }
    }
  }
  for (const pawn of initialization?.pawns ?? []) {
    if (!pawns.has(pawn.setId))
      fail(`initialization.pawns.${pawn.setId}`, 'ensemble de pions inconnu');
  }
  for (const component of components) {
    if (component.component !== 'collection.view') continue;
    const sources = [
      ...Object.values(component.groups),
      ...(component.total && component.total !== 'sum'
        ? [component.total]
        : []),
    ];
    for (const source of sources) {
      if (source.kind === 'inventory' && !inventories.has(source.id))
        fail(`components.${component.id}`, `inventaire inconnu: ${source.id}`);
    }
  }
}
