import * as fs from 'fs';
import * as path from 'path';
import type { GameStateEntity } from '../../../../application/models/game-state.model';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../application/models/game-action.model';
import type { GameRulesAdapter } from '../../../../application/contracts/game-rules-adapter.interface';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../../application/models/game-shortcuts.model';
import { GameRegistryService } from '../../../../engine/public-api';
import { buildBoardMissionShortcuts } from '../../../../application/helpers/board-mission.shortcuts';
import {
  getBoardMissionAvailableActions,
  validateBoardMissionAction,
} from '../../../../application/services/board-mission/board-mission.rulebook';
import { BoardMissionEngineService } from '../../../../application/services/board-mission/board-mission-engine.service';
import { BoardMissionPresenterService } from '../../../../application/services/board-mission/board-mission-presenter.service';
import { BoardMissionSetupService } from '../../../../application/services/board-mission/board-mission-setup.service';
import { BoardMissionBotService } from '../../../../application/services/board-mission/board-mission-bot.service';
import { BoardMissionModelLoaderService } from '../../../../infrastructure/system/board-mission-model-loader.service';
import type { BoardMissionGameMetadata } from '../../../../application/models/board-mission.model';

type BoardMissionManifest = {
  code?: string;
  id?: string;
  name?: string;
  summary?: string;
  description?: string;
  minPlayers?: number;
  maxPlayers?: number;
  category?: string;
  subcategory?: string;
  engine?: string;
  boardMission?: {
    actionLabel?: string;
    scorePanelTitle?: string;
    idleClientText?: string;
    idleRouteText?: string;
    idleEventText?: string;
    phases?: string[];
  };
};

export class BoardMissionRegistrarService {
  constructor(
    private readonly registry: GameRegistryService,
    private readonly modelLoader: BoardMissionModelLoaderService,
    private readonly engine: BoardMissionEngineService,
    private readonly presenter: BoardMissionPresenterService,
    private readonly setup: BoardMissionSetupService,
    private readonly bots: BoardMissionBotService,
  ) {}

  onModuleInit(): void {
    for (const entry of this.findBoardMissionGames()) {
      this.registry.register(this.buildHandler(entry));
    }
  }

  private buildHandler(entry: {
    manifest: BoardMissionManifest;
    id: string;
    gameDir: string;
  }): GameRulesAdapter {
    const ui = entry.manifest.boardMission ?? {};
    const definition = {
      id: entry.id,
      displayName: entry.manifest.name ?? entry.id,
      minPlayers: entry.manifest.minPlayers ?? 2,
      maxPlayers: entry.manifest.maxPlayers ?? 5,
      roles: [],
      actions: ['roll'],
      phaseOrder: (ui.phases ?? ['turn']).map((id) => ({
        id,
        kind: 'player-action' as const,
      })),
      victory: null,
    };

    return {
      gameType: entry.id,
      category: entry.manifest.category ?? 'JeuxDePlateaux',
      subcategory: entry.manifest.subcategory ?? 'LesQuatreVents',
      displayName: entry.manifest.name ?? entry.id,
      description: entry.manifest.summary ?? entry.manifest.description ?? '',
      minPlayers: entry.manifest.minPlayers,
      maxPlayers: entry.manifest.maxPlayers,
      hydrateInitialState: (baseState: GameStateEntity): GameStateEntity => {
        const model = this.modelLoader.load(entry.id, entry.gameDir);
        return this.setup.hydrateInitialState(
          baseState,
          model,
          (meta: BoardMissionGameMetadata) => ({
            ...meta,
            statuses: {
              skipTurn: Object.fromEntries(
                Object.keys(meta.positions ?? {}).map((key) => [
                  Number(key),
                  0,
                ]),
              ),
            },
            pendingContext: null,
          }),
        );
      },
      applyActions: (
        state: GameStateEntity,
        actions: GameSingleActionDto[],
      ): GameStateEntity => {
        return this.engine.applyActions(
          state,
          actions,
          this.modelLoader.load(entry.id, entry.gameDir),
        );
      },
      getAvailableActions: (
        state: GameStateEntity,
        playerId: number,
      ): GameSingleActionDto[] =>
        getBoardMissionAvailableActions(state, playerId),
      validateAction: (
        state: GameStateEntity,
        action: GameSingleActionDto,
        actorId: number | null,
      ): GameSingleActionDto =>
        validateBoardMissionAction(state, action, actorId, definition),
      getBotActions: (
        state: GameStateEntity,
        botPlayerId: number,
      ): GameSingleActionDto[] => this.bots.getBotActions(state, botPlayerId),
      exposeStateForUser: (
        state: GameStateEntity,
        userId: number,
      ): GameStateWithActions =>
        this.presenter.exposeStateForUser(
          state,
          userId,
          this.modelLoader.load(entry.id, entry.gameDir),
          {
            phases: definition.phaseOrder.map((phase) => phase.id),
            actionsLabel: ui.actionLabel ?? 'Lancer le de',
            scorePanelTitle: ui.scorePanelTitle ?? 'Trajets',
            idleClientText: ui.idleClientText ?? 'Aucun client a bord.',
            idleRouteText: ui.idleRouteText ?? 'Aucun trajet en cours.',
            idleEventText:
              ui.idleEventText ?? 'Pas d obstacle identifie.',
          },
        ),
      getShortcuts: (_ctx: GameShortcutsContext<unknown>): GameShortcutHint[] =>
        buildBoardMissionShortcuts(_ctx),
    };
  }

  private findBoardMissionGames(): Array<{
    manifest: BoardMissionManifest;
    id: string;
    gameDir: string;
  }> {
    const root = this.resolveGamesRoot();
    if (!root) return [];

    const manifests = this.findManifestPaths(root);
    const results: Array<{
      manifest: BoardMissionManifest;
      id: string;
      gameDir: string;
    }> = [];
    for (const manifestPath of manifests) {
      try {
        const raw = fs.readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(
          raw.replace(/^\uFEFF/, ''),
        ) as BoardMissionManifest;
        if (manifest.engine !== 'board-mission') continue;
        const id = manifest.code ?? manifest.id ?? '';
        if (!id) continue;
        results.push({
          manifest,
          id,
          gameDir: path.dirname(manifestPath),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error ?? '');
        console.warn(`Manifest board-mission ignore ${manifestPath}: ${message}`);
      }
    }
    return results;
  }

  private resolveGamesRoot(): string | null {
    const envRoot = process.env.GAME_MODULES_ROOT;
    const candidates = [
      envRoot && path.resolve(envRoot),
      path.resolve(process.cwd(), 'dist', 'game', 'games'),
      path.resolve(process.cwd(), 'dist', 'src', 'game', 'games'),
      path.resolve(process.cwd(), 'src', 'game', 'games'),
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    }
    return null;
  }

  private findManifestPaths(root: string): string[] {
    const stack: string[] = [root];
    const manifests: string[] = [];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
        } else if (entry.isFile() && entry.name === 'manifest.json') {
          manifests.push(fullPath);
        }
      }
    }
    return manifests;
  }
}
