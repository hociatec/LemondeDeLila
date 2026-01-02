import { Injectable } from '@nestjs/common';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { PanierExpressMetadata } from '../model/panier-express-state.entity';
import { PanierExpressSetupService } from '../setup/panier-express-setup.service';
import { playingLog } from '../../../../../common/utils/playing-logger';
import { PanierExpressUtils } from '../model/panier-express-utils.service';
import { PanierExpressDeckService } from './panier-express-deck.service';

@Injectable()
export class PanierExpressDrawService {
  constructor(
    private readonly setup: PanierExpressSetupService,
    private readonly core: GameCoreService,
    private readonly utils: PanierExpressUtils,
    private readonly deckHelper: PanierExpressDeckService,
  ) {}

  drawCourse(
    state: GameStateEntity,
    playerId: number,
    standId?: string,
  ): GameStateEntity {
    const meta = state.metadata as PanierExpressMetadata;
    const noDraw = (meta as any)?.statuses?.noDrawCourses?.[playerId] ?? 0;
    if (noDraw > 0) {
      return this.core.appendLog(
        state,
        `[Panier Express] ${this.utils.playerName(state, playerId)} ne peut pas piocher de carte ce tour-ci.`,
      );
    }
    const decks = meta.decks ?? this.setup.buildDeckPool(state);
    let metaAfter: PanierExpressMetadata = { ...meta, decks };

    const resolvedStandId = standId ?? this.findStandAtPosition(meta, playerId);
    const standKey = resolvedStandId ? `courses-${resolvedStandId}` : 'courses';

    const draw = this.drawAtStand(metaAfter, standKey, resolvedStandId);
    metaAfter = draw.metadata;
    if (!draw.card) {
      const debugLabel = resolvedStandId ? standKey : 'courses';
      return this.core.appendLog(
        state,
        `[Panier Express] Stand ${resolvedStandId || 'inconnu'} : aucune carte disponible (deck ${debugLabel}).`,
      );
    }

    const { card, metadata } = draw;
    const players = (state.players ?? []).map((player) => {
      if (player.id !== playerId) return player;
      const shoppingList = this.utils.toStringArray(player.shoppingList);
      const basket = this.utils.toStringArray(player.basket);
      const inventory = this.utils.toStringArray(player.inventory);
      if (shoppingList.includes(card) && !basket.includes(card)) {
        return { ...player, basket: [...basket, card], inventory };
      }
      return { ...player, inventory: [...inventory, card], basket };
    });

    const nextMeta: PanierExpressMetadata = {
      ...(metadata as any),
      lastObtainedCourse: {
        ...(((metadata as any)?.lastObtainedCourse ?? {}) as Record<
          number,
          string | null
        >),
        [playerId]: card,
      },
    };
    const nextState: GameStateEntity = { ...state, players, metadata: nextMeta as any };
    const standLabel = this.resolveStandLabel(meta, playerId, resolvedStandId);
    const courseLabel = this.utils.formatCourseLabel(card);
    const logged = this.core.appendLog(
      nextState,
      `[Panier Express] ${this.utils.playerName(state, playerId)} pioche "${courseLabel}" au stand ${standLabel}`,
    );

    const playerView = players.find((p) => p.id === playerId);
    playingLog('panier.draw', {
      roomId: (state.metadata as any)?.roomId ?? null,
      gameType: (state.metadata as any)?.gameType ?? null,
      userId: playerId,
      type: 'draw',
      playerId,
      card,
      standId: resolvedStandId || null,
      shoppingList: playerView?.shoppingList ?? [],
      basket: playerView?.basket ?? [],
      inventory: playerView?.inventory ?? [],
    });

    return logged;
  }

  private drawAtStand(
    meta: PanierExpressMetadata,
    standKey: string,
    standId?: string,
  ): { card: string | null; metadata: PanierExpressMetadata } {
    if (standId) {
      const replenish = () =>
        this.setup.buildReplenishableDeck(
          this.setup.standCourseMap()[standId] ?? this.setup.courseItems(),
        );
      const draw = this.deckHelper.drawWithReplenish<string>(
        meta,
        standKey,
        replenish,
      );
      if (draw.card) {
        return draw;
      }
      return this.deckHelper.drawWithReplenish<string>(
        draw.metadata,
        'courses',
        () => this.setup.buildReplenishableDeck(),
      );
    }
    return this.deckHelper.drawWithReplenish<string>(meta, 'courses', () =>
      this.setup.buildReplenishableDeck(),
    );
  }

  private findStandAtPosition(
    meta: PanierExpressMetadata,
    playerId: number,
  ): string | undefined {
    const pos = meta.positions?.[playerId] ?? 0;
    const tile = meta.tiles?.[pos];
    return tile?.type === 'stand' ? tile.standId : undefined;
  }

  private resolveStandLabel(
    meta: PanierExpressMetadata,
    playerId: number,
    explicitStand?: string,
  ): string {
    if (explicitStand) {
      return this.formatStandId(explicitStand);
    }
    const pos = meta.positions?.[playerId] ?? 0;
    const tile = meta.tiles?.[pos];
    if (tile?.type === 'stand') {
      return this.formatStandId(tile.standId);
    }
    playingLog('panier.draw.warn', {
      roomId: (meta as any)?.roomId ?? null,
      gameType: (meta as any)?.gameType ?? null,
      userId: playerId,
      type: 'draw_warn',
      playerId,
      reason: 'draw-outside-stand',
      position: pos,
      tileType: tile?.type ?? null,
      tileId: tile?.id ?? null,
    });
    return 'hors-stand';
  }

  private formatStandId(standId: string | undefined): string {
    const raw = (standId ?? 'inconnu').trim();
    if (!raw) return 'inconnu';
    const tokenMap: Record<string, string> = {
      legumes: 'l\u00e9gumes',
      ete: '\u00e9t\u00e9',
      maraicher: 'mara\u00eecher',
    };
    return raw
      .split('-')
      .map((token) => tokenMap[token] ?? token)
      .join('-');
  }
}
