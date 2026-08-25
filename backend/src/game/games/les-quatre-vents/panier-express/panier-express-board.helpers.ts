import {
  GameStateEntity,
  PendingState,
} from '../../../core/application/models/game-state.model';
import { TileEffectRegistryService } from '../../../effects/application/services/tile-effect-registry.service';
import { StandEffectRegistryService } from '../../../effects/application/services/stand-effect-registry.service';
import {
  PanierExpressMetadata,
  PanierExpressTile,
} from './model/panier-express-state.model';
import { toText } from './panier-express-state.helpers';

export function getPanierExpressStandLabel(
  standId: string | undefined,
): string {
  const raw = (standId ?? 'inconnu').trim();
  if (!raw) {
    return 'inconnu';
  }

  const tokenMap: Record<string, string> = {
    legumes: 'légumes',
    ete: 'été',
    maraicher: 'maraîcher',
  };

  return raw
    .split('-')
    .map((token) => tokenMap[token] ?? token)
    .join('-');
}

export function getPanierExpressTileLabel(
  tile: PanierExpressTile | undefined,
): string {
  if (!tile) {
    return 'inconnu';
  }

  const label = toText(tile.label).trim();
  if (label) {
    return label;
  }

  const fallbackId = tile.id ?? 'inconnu';
  switch (tile.type) {
    case 'start':
      return 'depart';
    case 'rest':
      return 'repos';
    case 'stand':
      return `stand ${getPanierExpressStandLabel(tile.standId)}`;
    case 'event':
      return 'evenement';
    case 'exchange':
      return 'échange';
    case 'quiz':
      return 'quiz';
    case 'move':
      return 'avancer/reculer';
    case 'move_choice':
      return 'stand au choix';
    case 'move_to_stand':
      return "avance jusqu'au prochain stand";
    case 'skip':
      return 'perd un tour';
    case 'bonus_course':
      return 'pioche course bonus';
    default:
      return fallbackId;
  }
}

export function resolvePanierExpressTile(args: {
  state: GameStateEntity;
  playerId: number;
  ensureMetadata: (state: GameStateEntity) => GameStateEntity;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
  buildTiles: () => PanierExpressTile[];
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  playerName: (state: GameStateEntity, playerId: number) => string;
  tileRegistry: TileEffectRegistryService<
    GameStateEntity,
    { playerId: number; tile: PanierExpressTile }
  >;
}): GameStateEntity {
  const ensured = args.ensureMetadata(args.state);
  const metadata = args.getMetadata(ensured);
  const tiles =
    Array.isArray(metadata.tiles) && metadata.tiles.length
      ? metadata.tiles
      : args.buildTiles();
  const position = metadata.positions[args.playerId] ?? 0;
  const tile = tiles[position] ?? null;
  if (!tile) {
    return args.appendLog(
      args.state,
      `[Panier Express] Résolution tuile: aucune tuile en position ${position} pour ${args.playerName(args.state, args.playerId)}.`,
    );
  }

  const label = getPanierExpressTileLabel(tile);
  const description = toText(tile.description).trim();
  const caseNumber = position + 1;
  const announced = args.appendLog(
    ensured,
    description
      ? `[Panier Express] Case ${caseNumber} : ${label} — ${description}`
      : `[Panier Express] Case ${caseNumber} : ${label}`,
  );

  return args.tileRegistry.apply(tile.type, announced, {
    playerId: args.playerId,
    tile,
  });
}

export function applyPanierExpressMerchantRequest(args: {
  state: GameStateEntity;
  playerId: number;
  ensureMetadata: (state: GameStateEntity) => GameStateEntity;
  courseItems: () => string[];
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
  createMetaRng: (metadata: PanierExpressMetadata) => {
    getMeta: () => PanierExpressMetadata;
  };
  pickOne: <T>(
    metadata: PanierExpressMetadata,
    items: T[],
  ) => { meta: PanierExpressMetadata; value: T | null };
  formatCourseLabel: (ingredient: string) => string;
  playerName: (state: GameStateEntity, playerId: number) => string;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  getPlayers: (
    state: GameStateEntity,
  ) => Array<{ id: number; inventory?: unknown }>;
  toStringArray: (value: unknown) => string[];
}): GameStateEntity {
  let next = args.ensureMetadata(args.state);
  const pool = args.courseItems();
  const metadata = args.getMetadata(next);
  const rng = args.createMetaRng(metadata);
  const pick = args.pickOne(rng.getMeta(), pool);
  next = {
    ...next,
    metadata: pick.meta,
  };

  const ingredient = String(pick.value ?? '').trim();
  const label = args.formatCourseLabel(ingredient);
  const playerName = args.playerName(args.state, args.playerId);
  if (!ingredient) {
    return args.appendLog(
      next,
      `[Panier Express] Case Échange : ${playerName} n'obtient aucune demande.`,
    );
  }

  next = args.appendLog(
    next,
    `[Panier Express] Case Échange : ${playerName} est sollicité pour "${label}".`,
  );

  const player = args
    .getPlayers(next)
    .find((entry) => entry.id === args.playerId);
  const inventory = args.toStringArray(player?.inventory);
  const hasInventory = inventory.length > 0;
  const pending: PendingState = {
    type: 'pick',
    playerId: args.playerId,
    blocking: true,
    question: hasInventory
      ? `Le marchand souhaite "${label}". Sélectionnez l'ingrédient demandé ou "Refuser".`
      : `Le marchand souhaite "${label}". Inventaire vide.`,
    choices: hasInventory ? ['Refuser', ...inventory] : ['Refuser'],
    data: { kind: 'merchant_request.choose', ingredient },
  };

  return { ...next, pending };
}

export function registerPanierExpressTileHandlers(args: {
  tileRegistry: TileEffectRegistryService<
    GameStateEntity,
    { playerId: number; tile: PanierExpressTile }
  >;
  applyStand: (
    standId: string,
    state: GameStateEntity,
    ctx: { playerId: number; standId: string; state: GameStateEntity },
  ) => GameStateEntity;
  startDrawPending: (
    state: GameStateEntity,
    playerId: number,
    data: Record<string, unknown>,
    label: string,
  ) => GameStateEntity;
  applyMerchantRequest: (
    state: GameStateEntity,
    playerId: number,
  ) => GameStateEntity;
  applyExchange: (state: GameStateEntity, playerId: number) => GameStateEntity;
  applyQuiz: (state: GameStateEntity, playerId: number) => GameStateEntity;
  applyMoveToStandChoice: (
    state: GameStateEntity,
    playerId: number,
  ) => GameStateEntity;
  applyWeatherBack: (
    state: GameStateEntity,
    playerId: number,
  ) => GameStateEntity;
  applyMoveDelta: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ) => GameStateEntity;
  applyMoveChoice: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ) => GameStateEntity;
  applySkipTurnTile: (
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ) => GameStateEntity;
  queueCourseDraws: (
    state: GameStateEntity,
    tasks: Array<{ playerId: number; standId?: string }>,
    label: string,
  ) => GameStateEntity;
  applyMoveToNextStand: (
    state: GameStateEntity,
    playerId: number,
  ) => GameStateEntity;
}): void {
  args.tileRegistry.register('rest', (state) => state);
  args.tileRegistry.register('stand', (state, ctx) =>
    args.applyStand('stand', state, {
      playerId: ctx.playerId,
      standId: ctx.tile.type === 'stand' ? ctx.tile.standId : 'stand',
      state,
    }),
  );
  args.tileRegistry.register('event', (state, ctx) =>
    args.startDrawPending(
      state,
      ctx.playerId,
      { kind: 'event.card' },
      'Piocher une carte Événement (Espace).',
    ),
  );
  args.tileRegistry.register('exchange', (state, ctx) => {
    if (ctx.tile?.id === 'case-5-echange') {
      return args.applyMerchantRequest(state, ctx.playerId);
    }
    return args.applyExchange(state, ctx.playerId);
  });
  args.tileRegistry.register('quiz', (state, ctx) =>
    args.applyQuiz(state, ctx.playerId),
  );
  args.tileRegistry.register('move', (state, ctx) => {
    if (ctx.tile?.id === 'case-7-avance-1') {
      return args.applyMoveToStandChoice(state, ctx.playerId);
    }
    if (ctx.tile?.id === 'case-29-meteo') {
      return args.applyWeatherBack(state, ctx.playerId);
    }
    return args.applyMoveDelta(
      state,
      ctx.playerId,
      ctx.tile.type === 'move' ? (ctx.tile.delta ?? 0) : 0,
    );
  });
  args.tileRegistry.register('move_choice', (state, ctx) =>
    args.applyMoveChoice(
      state,
      ctx.playerId,
      ctx.tile.type === 'move_choice' ? (ctx.tile.delta ?? 0) : 0,
    ),
  );
  args.tileRegistry.register('skip', (state, ctx) =>
    args.applySkipTurnTile(
      state,
      ctx.playerId,
      ctx.tile.type === 'skip' ? (ctx.tile.turns ?? 1) : 1,
    ),
  );
  args.tileRegistry.register('bonus_course', (state, ctx) =>
    args.queueCourseDraws(
      state,
      [{ playerId: ctx.playerId, standId: 'bonus' }],
      'Piocher une course bonus (Espace).',
    ),
  );
  args.tileRegistry.register('move_to_stand', (state, ctx) =>
    args.applyMoveToNextStand(state, ctx.playerId),
  );
}

export function registerPanierExpressStandHandlers(args: {
  standEffects: StandEffectRegistryService<GameStateEntity>;
  standIds: () => string[];
  queueCourseDraws: (
    state: GameStateEntity,
    tasks: Array<{ playerId: number; standId?: string }>,
    label: string,
  ) => GameStateEntity;
}): void {
  args.standEffects.registerStand('stand', (state, ctx) =>
    args.queueCourseDraws(
      state,
      [{ playerId: ctx.playerId, standId: ctx.standId }],
      'Piocher une course (Espace).',
    ),
  );

  args.standIds().forEach((id) => {
    args.standEffects.registerStand(id, (state, ctx) =>
      args.queueCourseDraws(
        state,
        [{ playerId: ctx.playerId, standId: ctx.standId }],
        'Piocher une course (Espace).',
      ),
    );
  });
}






