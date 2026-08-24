import type {
  GameStateEntity,
  PendingState,
} from '../../../../../application/models/game-state.model';
import {
  applyActionsSequentially,
  dispatchByActionType,
  normalizeActionType,
} from '../../../../../application/helpers/action-service.helper';
import { resolvePlayerNameFromState } from '../../../../../application/helpers/player-name.helper';

import type { GameSingleActionDto } from '../../../../../models/game-action.model';

import { GameCoreService } from '../../../../../application/services/game-core.service';
import { RandomService } from '../../../../../application/services/random.service';
import { DeckPoliciesService } from '../../../../../application/features/deck-policies/services/deck-policies.service';
import { SacAMalicesSetupService } from '../application/services/sac-a-malices-setup.service';
import type {
  SacCard,
  SacDeck,
  SacGroupsJsonV1,
  SacMetadata,
  SacTile,
} from '../../model/sac-a-malices.types';
import { applySacAMalicesVariantConfig } from './sac-a-malices-variant-action.helper';
import {
  openSacAMalicesPropertyChoice,
  resolveSacAMalicesPropertyChoice,
  type SacPropertyChoiceKind,
} from './sac-a-malices-property-choice.helper';
import { applySacAMalicesLanding } from './sac-a-malices-landing.helper';
import {
  applySacAMalicesCardEffect,
  shouldKeepSacAMalicesCard,
} from './sac-a-malices-card-effect.helper';
import {
  moveSacAMalicesForward,
  moveSacAMalicesTo,
  sendSacAMalicesToJail,
} from './sac-a-malices-movement.helper';
import {
  applySacAMalicesBuyDecision,
  applySacAMalicesPayFine,
  applySacAMalicesUseJailCard,
} from './sac-a-malices-turn-actions.helper';
import {
  applySacAMalicesDrawAndApply,
  drawSacAMalicesCard,
} from './sac-a-malices-draw-card.helper';
import { SacAMalicesPropertyService } from './sac-a-malices-property.service';
import { SacAMalicesEconomyService } from './sac-a-malices-economy.service';
import {
  addSacSkipTurn,
  setSacConsecutiveDoubles,
  setSacExtraRoll,
  setSacGetOutOfJailCount,
  setSacJailTurns,
  setSacOwner,
  setSacPosition,
  setSacPot,
} from './sac-a-malices-state-updates.helper';
import {
  advanceSacTurn,
  asSacRecord as asRecord,
  clampSacValue as clamp,
  findSacJailTile,
  findSacTileByName,
  getSacPawnLabel,
  normalizeSacText as normalize,
  resolveSacRules,
  stripSacParens as stripParens,
  toSacNumberValue as toNumberValue,
  toSacStringValue as toStringValue,
} from './sac-a-malices-action.utils';


export class SacAMalicesActionService {
  constructor(
    private readonly random: RandomService,
    private readonly core: GameCoreService,
    private readonly setup: SacAMalicesSetupService,
    private readonly deckPolicies: DeckPoliciesService,
    private readonly propertySvc: SacAMalicesPropertyService,
    private readonly economySvc: SacAMalicesEconomyService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    const next = applyActionsSequentially(state, actions, (next, action) => {
      const type = normalizeActionType(action);
      return dispatchByActionType(
        type,
        {
          sac_set_variant: () => {
            next = this.applyVariantConfig(next, action);
            return next;
          },
          roll: () => {
            next = this.handleRoll(next);
            return next;
          },
          buy: () => {
            next = this.handleBuy(next, true);
            return next;
          },
          skip_buy: () => {
            next = this.handleBuy(next, false);
            return next;
          },
          build: () => {
            next = this.openChooseProperty(next, 'build');
            return next;
          },
          sell_building: () => {
            next = this.openChooseProperty(next, 'sell_building');
            return next;
          },
          mortgage: () => {
            next = this.openChooseProperty(next, 'mortgage');
            return next;
          },
          unmortgage: () => {
            next = this.openChooseProperty(next, 'unmortgage');
            return next;
          },
          choose_property: () => {
            next = this.handleChooseProperty(next, action);
            return next;
          },
          pay_fine: () => {
            next = this.handlePayFine(next);
            return next;
          },
          use_jail_card: () => {
            next = this.handleUseJailCard(next);
            return next;
          },
        },
        () => next,
      );
    });
    return next;
  }

  private applyVariantConfig(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    return applySacAMalicesVariantConfig({
      state,
      action,
      variantId: meta.variantId,
      setupStep: meta.setupStep,
      applyVariantSelection: (current, variantId) =>
        this.setup.applyVariantSelection(current, variantId),
      appendLog: (current, message) => this.core.appendLog(current, message),
    });
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    if (state.pending) return state;
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    let meta = this.getMeta(state);
    if (meta.statuses?.eliminated?.[currentId]) {
      return this.advanceTurn(state);
    }

    const rules = resolveSacRules(meta);

    // Prison
    const jailTurns = meta.statuses?.inJail?.[currentId] ?? 0;
    if (jailTurns > 0) {
      if (rules.jail.allowDoubleEscape) {
        // 2d6 : si double => sortie immÃƒÆ’Ã‚Â©diate et dÃƒÆ’Ã‚Â©placement ; sinon on attend.
        const r1 = this.random.rollDice(meta as Record<string, unknown>, 6);
        const r2 = this.random.rollDice(r1.meta, 6);
        meta = { ...meta, ...r2.meta };
        const d1 = r1.roll;
        const d2 = r2.roll;
        const sum = d1 + d2;
        const isDouble = d1 === d2;

        let next: GameStateEntity = {
          ...state,
          lastRoll: sum,
          metadata: { ...(state.metadata ?? {}), ...meta },
        };
        next = this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, currentId)} lance les dÃƒÆ’Ã‚Â©s : "${d1}" + "${d2}" = "${sum}".`,
        );

        if (!isDouble) {
          const remainingTurns = Math.max(0, jailTurns - 1);
          next = this.setJailTurns(next, currentId, remainingTurns);
          if (remainingTurns <= 0) {
            if (rules.jail.autoFine > 0) {
              next = this.core.appendLog(
                next,
                `Sortie automatique : amende ${rules.jail.autoFine} ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬.`,
              );
              next = this.addMoney(next, currentId, -rules.jail.autoFine, {
                toPot: true,
              });
            } else {
              next = this.core.appendLog(next, 'Sortie automatique.');
            }
            next = this.setJailTurns(next, currentId, 0);
          } else {
            next = this.core.appendLog(
              next,
              `Prison : il reste ${remainingTurns} tour(s).`,
            );
          }
          next = this.checkWinner(next);
          if (this.getMeta(next).winnerId != null)
            return { ...next, status: 'finished' };
          return this.advanceTurn(next);
        }

        next = this.core.appendLog(next, 'Double : vous sortez de prison.');
        next = this.setJailTurns(next, currentId, 0);
        next = this.setConsecutiveDoubles(next, currentId, 0);

        // On rejoue / on se dÃƒÆ’Ã‚Â©place normalement aprÃƒÆ’Ã‚Â¨s la sortie.
        next = this.moveForward(next, currentId, sum);
        next = this.applyLanding(next, currentId);
        next = this.checkWinner(next);
        if (this.getMeta(next).winnerId != null)
          return { ...next, status: 'finished' };
        if (next.pending) {
          next = this.setExtraRoll(next, currentId, true);
          return next;
        }
        next = this.core.appendLog(next, 'Double : vous rejouez.');
        next = this.setExtraRoll(next, currentId, true);
        return next;
      }

      // Version "attente" : on attend N tours, puis amende auto (si configurÃƒÆ’Ã‚Â©e).
      let next = this.setJailTurns(
        state,
        currentId,
        Math.max(0, jailTurns - 1),
      );
      const remaining = this.getMeta(next).statuses?.inJail?.[currentId] ?? 0;
      if (remaining <= 0) {
        if (rules.jail.autoFine > 0) {
          next = this.core.appendLog(
            next,
            `Sortie automatique : amende ${rules.jail.autoFine} ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬.`,
          );
          next = this.addMoney(next, currentId, -rules.jail.autoFine, {
            toPot: true,
          });
        } else {
          next = this.core.appendLog(next, 'Sortie automatique.');
        }
      } else {
        next = this.core.appendLog(
          next,
          `Prison : il reste ${remaining} tour(s).`,
        );
      }
      next = this.checkWinner(next);
      if (this.getMeta(next).winnerId != null)
        return { ...next, status: 'finished' };
      return this.advanceTurn(next);
    }

    // On consomme l'ÃƒÆ’Ã‚Â©ventuel bonus "rejouer" ÃƒÆ’Ã‚Â  l'entrÃƒÆ’Ã‚Â©e du lancer.
    state = this.setExtraRoll(state, currentId, false);
    meta = this.getMeta(state);

    // 2d6
    const r1 = this.random.rollDice(meta as Record<string, unknown>, 6);
    const r2 = this.random.rollDice(r1.meta, 6);
    meta = { ...meta, ...r2.meta };
    const d1 = r1.roll;
    const d2 = r2.roll;
    const sum = d1 + d2;
    const isDouble = d1 === d2;

    let next: GameStateEntity = {
      ...state,
      lastRoll: sum,
      metadata: { ...(state.metadata ?? {}), ...meta },
    };

    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} lance les dÃƒÆ’Ã‚Â©s : "${d1}" + "${d2}" = "${sum}".`,
    );

    // Doubles : rejouer, 3 doubles consÃƒÆ’Ã‚Â©cutifs => prison.
    const prevDoubles =
      this.getMeta(next).statuses?.consecutiveDoubles?.[currentId] ?? 0;
    const doubles = isDouble ? prevDoubles + 1 : 0;
    next = this.setConsecutiveDoubles(next, currentId, doubles);
    if (doubles >= 3) {
      next = this.core.appendLog(next, 'Trois doubles : direction la prison.');
      next = this.sendToJail(next, currentId);
      next = this.setConsecutiveDoubles(next, currentId, 0);
      next = this.setExtraRoll(next, currentId, false);
      next = this.checkWinner(next);
      if (this.getMeta(next).winnerId != null)
        return { ...next, status: 'finished' };
      return this.advanceTurn(next);
    }

    meta = this.getMeta(next);
    if (meta.statuses?.eliminated?.[currentId]) {
      next = this.checkWinner(next);
      if (this.getMeta(next).winnerId != null)
        return { ...next, status: 'finished' };
      return this.advanceTurn(next);
    }

    // (prison gÃƒÆ’Ã‚Â©rÃƒÆ’Ã‚Â©e avant le lancer)

    // DÃƒÆ’Ã‚Â©placement
    next = this.moveForward(next, currentId, sum);
    next = this.applyLanding(next, currentId);
    next = this.checkWinner(next);
    if (this.getMeta(next).winnerId != null)
      return { ...next, status: 'finished' };
    if (next.pending) {
      if (isDouble) {
        next = this.setExtraRoll(next, currentId, true);
      }
      return next;
    }

    if (isDouble) {
      next = this.core.appendLog(next, 'Double : vous rejouez.');
      next = this.setExtraRoll(next, currentId, true);
      return next;
    }

    return this.advanceTurn(next);
  }

  private handleBuy(state: GameStateEntity, accept: boolean): GameStateEntity {
    return applySacAMalicesBuyDecision({
      state,
      accept,
      appendLog: (current, message) => this.core.appendLog(current, message),
      getMeta: (current) => this.getMeta(current),
      getPurchasePrice: (meta, tile) =>
        this.economySvc.getPurchasePrice(meta, tile),
      addMoney: (current, playerId, delta, options) =>
        this.addMoney(current, playerId, delta, options),
      setOwner: (current, tileIndex, playerId) =>
        this.setOwner(current, tileIndex, playerId),
      checkWinner: (current) => this.checkWinner(current),
      getWinnerId: (current) => this.getMeta(current).winnerId ?? null,
      advanceTurnOrExtraRoll: (current, playerId) =>
        this.advanceTurnOrExtraRoll(current, playerId),
    });
  }

  private handlePayFine(state: GameStateEntity): GameStateEntity {
    return applySacAMalicesPayFine({
      state,
      appendLog: (current, message) => this.core.appendLog(current, message),
      getAutoFine: (current) =>
        resolveSacRules(this.getMeta(current)).jail.autoFine,
      isPayFineAllowed: (current) =>
        resolveSacRules(this.getMeta(current)).jail.allowPayFine,
      getJailTurns: (current, playerId) =>
        this.getMeta(current).statuses?.inJail?.[playerId] ?? 0,
      addMoney: (current, playerId, delta, options) =>
        this.addMoney(current, playerId, delta, options),
      setJailTurns: (current, playerId, turns) =>
        this.setJailTurns(current, playerId, turns),
      checkWinner: (current) => this.checkWinner(current),
      getWinnerId: (current) => this.getMeta(current).winnerId ?? null,
    });
  }

  private handleUseJailCard(state: GameStateEntity): GameStateEntity {
    return applySacAMalicesUseJailCard({
      state,
      appendLog: (current, message) => this.core.appendLog(current, message),
      getJailTurns: (current, playerId) =>
        this.getMeta(current).statuses?.inJail?.[playerId] ?? 0,
      getJailCardCount: (current, playerId) =>
        this.getMeta(current).statuses?.getOutOfJail?.[playerId] ?? 0,
      setGetOutOfJail: (current, playerId, count) =>
        this.setGetOutOfJail(current, playerId, count),
      setJailTurns: (current, playerId, turns) =>
        this.setJailTurns(current, playerId, turns),
    });
  }

  private openChooseProperty(
    state: GameStateEntity,
    kind: SacPropertyChoiceKind,
  ): GameStateEntity {
    return openSacAMalicesPropertyChoice({
      state,
      kind,
      getCurrentPlayerId: (current) => current.turn?.currentPlayerId ?? null,
      getMeta: (current) => this.getMeta(current),
      buildOptions: (meta, playerId, currentKind) =>
        this.buildPropertyChoiceOptions(meta, playerId, currentKind),
      appendLog: (current, message) => this.core.appendLog(current, message),
    });
  }

  private handleChooseProperty(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    let next = resolveSacAMalicesPropertyChoice({
      state,
      action,
      getCurrentPlayerId: (current) => current.turn?.currentPlayerId ?? null,
      getMeta: (current) => this.getMeta(current),
      applyChoice: ({ state: current, kind, playerId, tileIndex }) => {
        if (kind === 'build') {
          return this.buildOne(current, playerId, tileIndex);
        }
        if (kind === 'sell_building') {
          return this.sellOne(current, playerId, tileIndex);
        }
        if (kind === 'mortgage') {
          return this.mortgageTile(current, playerId, tileIndex);
        }
        return this.unmortgageTile(current, playerId, tileIndex);
      },
    });
    if (next === state) return state;
    next = this.checkWinner(next);
    if (this.getMeta(next).winnerId != null)
      return { ...next, status: 'finished' };
    return next;
  }

  private buildPropertyChoiceOptions(
    meta: SacMetadata,
    playerId: number,
    kind: SacPropertyChoiceKind,
  ): Array<{ tileIndex: number; label: string }> {
    const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
    const myCash = meta.money?.[playerId] ?? 0;
    const options: Array<{ tileIndex: number; label: string }> = [];

    for (let tileIndex = 0; tileIndex < tiles.length; tileIndex += 1) {
      const tile = tiles[tileIndex];
      if (!tile) continue;
      if (meta.ownership?.[tileIndex] !== playerId) continue;

      const building = this.propertySvc.getBuilding(meta, tileIndex);

      if (kind === 'build') {
        if (tile.type !== 'property') continue;
        if (building.mortgaged || building.hotel) continue;
        const group = this.propertySvc.getGroup(meta, tile.group ?? '');
        if (!group) continue;
        if (
          !this.propertySvc.isGroupComplete(
            meta,
            playerId,
            group,
            (sourceTiles, rawName) => this.findTileByName(sourceTiles, rawName),
          )
        )
          continue;
        const supportsHotel =
          Number(group.hotelPrice ?? 0) > 0 &&
          Number(group.rents?.hotel ?? 0) > 0;
        if (!supportsHotel && building.houses >= 4) continue;
        const nextLevel = clamp(building.houses + 1, 1, 4);
        const houseCost = this.propertySvc.getHouseCost(group, nextLevel);
        const cost =
          supportsHotel && building.houses >= 4
            ? Number(group.hotelPrice ?? 0) || 0
            : houseCost;
        if (!Number.isFinite(cost) || cost <= 0 || myCash < cost) continue;
        options.push({ tileIndex, label: `${tile.title} (coÃƒÆ’Ã‚Â»t ${cost} ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬)` });
        continue;
      }

      if (kind === 'sell_building') {
        if (tile.type !== 'property') continue;
        if (!building.hotel && building.houses <= 0) continue;
        const group = this.propertySvc.getGroup(meta, tile.group ?? '');
        const supportsHotel =
          Number(group?.hotelPrice ?? 0) > 0 &&
          Number(group?.rents?.hotel ?? 0) > 0;
        const refund = (() => {
          if (!group) return 0;
          if (supportsHotel && building.hotel) {
            return Math.floor((Number(group.hotelPrice ?? 0) || 0) / 2);
          }
          const level = clamp(building.houses, 1, 4);
          const cost = this.propertySvc.getHouseCost(group, level);
          return Math.floor(cost / 2);
        })();
        options.push({ tileIndex, label: `${tile.title} (remb. ${refund} ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬)` });
        continue;
      }

      if (kind === 'mortgage') {
        if (building.mortgaged) continue;
        if (tile.type === 'property' && (building.hotel || building.houses > 0)) {
          continue;
        }
        const amount = this.propertySvc.getMortgageValue(meta, tile);
        if (!Number.isFinite(amount) || amount <= 0) continue;
        options.push({ tileIndex, label: `${tile.title} (+${amount} ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬)` });
        continue;
      }

      if (!building.mortgaged) continue;
      const cost = this.propertySvc.getUnmortgageCost(meta, tile);
      if (!Number.isFinite(cost) || cost <= 0 || myCash < cost) continue;
      options.push({ tileIndex, label: `${tile.title} (-${cost} ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬)` });
    }

    return options;
  }

  private applyLanding(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    return applySacAMalicesLanding({
      state,
      playerId,
      getMeta: (current) => this.getMeta(current),
      appendLog: (current, message) => this.core.appendLog(current, message),
      pawnLabel: (current, targetPlayerId) =>
        getSacPawnLabel(current, targetPlayerId),
      getRules: (meta) => resolveSacRules(meta),
      setPot: (current, value) => this.setPot(current, value),
      addMoney: (current, targetPlayerId, delta, options) =>
        this.addMoney(current, targetPlayerId, delta, options),
      sendToJail: (current, targetPlayerId) =>
        this.sendToJail(current, targetPlayerId),
      drawAndApply: (current, targetPlayerId, deckId) =>
        this.drawAndApply(current, targetPlayerId, deckId),
      getPurchasePrice: (meta, tile) =>
        this.economySvc.getPurchasePrice(meta, tile),
      getBuilding: (meta, tileIndex) =>
        this.propertySvc.getBuilding(meta, tileIndex),
      getRent: (meta, tile, tileIndex, owner, lastRoll) =>
        this.economySvc.getRent(meta, tile, tileIndex, owner, lastRoll),
    });
  }

  private drawAndApply(
    state: GameStateEntity,
    playerId: number,
    deckId: 'chance' | 'community',
  ): GameStateEntity {
    return applySacAMalicesDrawAndApply({
      state,
      playerId,
      deckId,
      getMeta: (current) => this.getMeta(current),
      drawCard: (meta, currentDeckId) => this.drawCard(meta, currentDeckId),
      appendLog: (current, message) => this.core.appendLog(current, message),
      applyCard: (current, targetPlayerId, currentDeckId, card) =>
        this.applyCard(current, targetPlayerId, currentDeckId, card),
    });
  }

  private applyCard(
    state: GameStateEntity,
    playerId: number,
    _deckId: 'chance' | 'community',
    card: SacCard,
  ): GameStateEntity {
    return applySacAMalicesCardEffect({
      state,
      playerId,
      card,
      getMeta: (current) => this.getMeta(current),
      getRules: (meta) => resolveSacRules(meta),
      appendLog: (current, message) => this.core.appendLog(current, message),
      setGetOutOfJail: (current, targetPlayerId, count) =>
        this.setGetOutOfJail(current, targetPlayerId, count),
      addMoney: (current, targetPlayerId, delta, options) =>
        this.addMoney(current, targetPlayerId, delta, options),
      loseOneInfrastructure: (current, targetPlayerId) =>
        this.economySvc.loseOneInfrastructure(
          current,
          targetPlayerId,
          (value) => this.getMeta(value),
          (meta, values) =>
            this.random.pickOne(meta as Record<string, unknown>, values),
        ),
      moveForward: (current, targetPlayerId, delta) =>
        this.moveForward(current, targetPlayerId, delta),
      applyLanding: (current, targetPlayerId) =>
        this.applyLanding(current, targetPlayerId),
      moveTo: (current, targetPlayerId, pos, options) =>
        this.moveTo(current, targetPlayerId, pos, options),
      findTileByName: (tiles, rawName) =>
        this.economySvc.findTileByName(tiles, rawName),
      addSkip: (current, targetPlayerId, turns) =>
        this.addSkip(current, targetPlayerId, turns),
    });
  }

  private drawCard(
    meta: SacMetadata,
    deckId: 'chance' | 'community',
  ): { card: SacCard | null; meta: SacMetadata } {
    return drawSacAMalicesCard({
      meta,
      deckId,
      drawFromPile: (currentMeta, deck) =>
        this.deckPolicies.drawFromPile<SacCard, SacMetadata>({
          meta: currentMeta,
          pile: deck.cards,
          discard: deck.discard,
          useWholeMetaRng: true,
          discardDrawnCard: false,
        }),
    });
  }

  private moveForward(
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ): GameStateEntity {
    return moveSacAMalicesForward({
      state,
      playerId,
      delta,
      getMeta: (current) => this.getMeta(current),
      getRules: (meta) => resolveSacRules(meta),
      setPos: (current, targetPlayerId, pos) =>
        this.setPos(current, targetPlayerId, pos),
      addMoney: (current, targetPlayerId, amount, options) =>
        this.addMoney(current, targetPlayerId, amount, options),
      appendLog: (current, message) => this.core.appendLog(current, message),
    });
  }

  private moveTo(
    state: GameStateEntity,
    playerId: number,
    pos: number,
    options: { collectStart: boolean },
  ): GameStateEntity {
    return moveSacAMalicesTo({
      state,
      playerId,
      pos,
      collectStart: options.collectStart,
      getMeta: (current) => this.getMeta(current),
      getRules: (meta) => resolveSacRules(meta),
      setPos: (current, targetPlayerId, nextPos) =>
        this.setPos(current, targetPlayerId, nextPos),
      addMoney: (current, targetPlayerId, amount, moveOptions) =>
        this.addMoney(current, targetPlayerId, amount, moveOptions),
      appendLog: (current, message) => this.core.appendLog(current, message),
    });
  }

  private sendToJail(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    return sendSacAMalicesToJail({
      state,
      playerId,
      getMeta: (current) => this.getMeta(current),
      getRules: (meta) => resolveSacRules(meta),
      setPos: (current, targetPlayerId, pos) =>
        this.setPos(current, targetPlayerId, pos),
      setJailTurns: (current, targetPlayerId, turns) =>
        this.setJailTurns(current, targetPlayerId, turns),
      findJailTile: (tiles) => findSacJailTile(tiles),
    });
  }

  private findTileByName(
    tiles: SacTile[] | undefined,
    rawName: string,
  ): number | null {
    return findSacTileByName(tiles, rawName);
  }

  private setPos(
    state: GameStateEntity,
    playerId: number,
    pos: number,
  ): GameStateEntity {
    return setSacPosition(state, this.getMeta(state), playerId, pos, clamp);
  }

  private setOwner(
    state: GameStateEntity,
    tileIndex: number,
    ownerId: number,
  ): GameStateEntity {
    return setSacOwner(state, this.getMeta(state), tileIndex, ownerId);
  }

  private setPot(state: GameStateEntity, value: number): GameStateEntity {
    return setSacPot(state, this.getMeta(state), value);
  }

  private addSkip(
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ): GameStateEntity {
    return addSacSkipTurn(state, this.getMeta(state), playerId, turns);
  }

  private setJailTurns(
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ): GameStateEntity {
    return setSacJailTurns(state, this.getMeta(state), playerId, turns);
  }

  private setGetOutOfJail(
    state: GameStateEntity,
    playerId: number,
    count: number,
  ): GameStateEntity {
    return setSacGetOutOfJailCount(state, this.getMeta(state), playerId, count);
  }

  private setExtraRoll(
    state: GameStateEntity,
    playerId: number,
    value: boolean,
  ): GameStateEntity {
    return setSacExtraRoll(state, this.getMeta(state), playerId, value);
  }

  private setConsecutiveDoubles(
    state: GameStateEntity,
    playerId: number,
    value: number,
  ): GameStateEntity {
    return setSacConsecutiveDoubles(state, this.getMeta(state), playerId, value);
  }

  private advanceTurnOrExtraRoll(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    if (meta.statuses?.eliminated?.[playerId]) return this.advanceTurn(state);
    if (meta.statuses?.extraRoll?.[playerId]) {
      let next = this.setExtraRoll(state, playerId, false);
      next = this.core.appendLog(next, 'Double : vous rejouez.');
      return next;
    }
    return this.advanceTurn(state);
  }


  private buildOne(
    state: GameStateEntity,
    playerId: number,
    tileIndex: number,
  ): GameStateEntity {
    return this.propertySvc.buildOne(
      state,
      playerId,
      tileIndex,
      (current) => this.getMeta(current),
      (tiles, rawName) => this.findTileByName(tiles, rawName),
      (current, ownerId, delta, options) =>
        this.addMoney(current, ownerId, delta, options),
    );
  }

  private sellOne(
    state: GameStateEntity,
    playerId: number,
    tileIndex: number,
  ): GameStateEntity {
    return this.propertySvc.sellOne(
      state,
      playerId,
      tileIndex,
      (current) => this.getMeta(current),
      (current, ownerId, delta, options) =>
        this.addMoney(current, ownerId, delta, options),
    );
  }

  private mortgageTile(
    state: GameStateEntity,
    playerId: number,
    tileIndex: number,
  ): GameStateEntity {
    return this.propertySvc.mortgageTile(
      state,
      playerId,
      tileIndex,
      (current) => this.getMeta(current),
      (current, ownerId, delta, options) =>
        this.addMoney(current, ownerId, delta, options),
    );
  }

  private unmortgageTile(
    state: GameStateEntity,
    playerId: number,
    tileIndex: number,
  ): GameStateEntity {
    return this.propertySvc.unmortgageTile(
      state,
      playerId,
      tileIndex,
      (current) => this.getMeta(current),
      (current, ownerId, delta, options) =>
        this.addMoney(current, ownerId, delta, options),
    );
  }

  private getBuilding(meta: SacMetadata, tileIndex: number) {
    return this.propertySvc.getBuilding(meta, tileIndex);
  }

  private setBuilding(
    state: GameStateEntity,
    tileIndex: number,
    patch: Partial<{ houses: number; hotel: boolean; mortgaged: boolean }>,
  ): GameStateEntity {
    return this.propertySvc.setBuilding(state, tileIndex, patch);
  }

  private getGroup(meta: SacMetadata, color: string) {
    return this.propertySvc.getGroup(meta, color);
  }

  private loseOneInfrastructure(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    return this.economySvc.loseOneInfrastructure(
      state,
      playerId,
      (current) => this.getMeta(current),
      (meta, values) =>
        this.random.pickOne(meta as Record<string, unknown>, values),
    );
  }

  /*
    const meta0 = this.getMeta(state);
    const tiles = Array.isArray(meta0.tiles) ? meta0.tiles : [];

    const ownedWithInfra: number[] = [];
    for (let i = 0; i < tiles.length; i += 1) {
      const owner = meta0.ownership?.[i];
      if (owner !== playerId) continue;
      const tile = tiles[i];
      if (!tile || tile.type !== 'property') continue;
      const b = this.getBuilding(meta0, i);
      if (b.hotel || b.houses > 0) ownedWithInfra.push(i);
    }

    if (!ownedWithInfra.length) {
      return this.core.appendLog(state, 'Aucune infrastructure ÃƒÆ’Ã‚Â  perdre.');
    }

    const picked = this.random.pickOne(
      meta0 as Record<string, unknown>,
      ownedWithInfra,
    );
    let next: GameStateEntity = {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        ...meta0,
        ...picked.meta,
      },
    };
    const tileIndex = picked.value;
    if (tileIndex == null) return next;

    const tile = tiles[tileIndex];
    const group = tile
      ? this.getGroup(this.getMeta(next), tile.group ?? '')
      : null;
    const supportsHotel =
      Number(group?.hotelPrice ?? 0) > 0 &&
      Number(group?.rents?.hotel ?? 0) > 0;

    const b = this.getBuilding(this.getMeta(next), tileIndex);
    if (supportsHotel && b.hotel) {
      next = this.core.appendLog(
        next,
        `Infrastructure perdue : hÃƒÆ’Ã‚Â´tel sur "${tile?.title ?? 'propriÃƒÆ’Ã‚Â©tÃƒÆ’Ã‚Â©'}".`,
      );
      return this.setBuilding(next, tileIndex, { hotel: false, houses: 4 });
    }
    if (b.houses > 0) {
      next = this.core.appendLog(
        next,
        `Infrastructure perdue : -1 sur "${tile?.title ?? 'propriÃƒÆ’Ã‚Â©tÃƒÆ’Ã‚Â©'}".`,
      );
      return this.setBuilding(next, tileIndex, {
        houses: Math.max(0, b.houses - 1),
      });
    }
    return next;
  }

  */
  private addMoney(
    state: GameStateEntity,
    playerId: number,
    delta: number,
    options: { toPot: boolean },
  ): GameStateEntity {
    return this.economySvc.addMoney(
      state,
      playerId,
      delta,
      options,
      (current) => this.getMeta(current),
    );
  }

  private releaseAssets(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    return this.economySvc.releaseAssets(
      state,
      playerId,
      (current) => this.getMeta(current),
    );
  }

  private setEliminated(
    state: GameStateEntity,
    playerId: number,
    value: boolean,
  ): GameStateEntity {
    return this.economySvc.setEliminated(
      state,
      playerId,
      value,
      (current) => this.getMeta(current),
    );
  }

  private getPurchasePrice(meta: SacMetadata, tile: SacTile): number {
    return this.economySvc.getPurchasePrice(meta, tile);
  }

  private getRent(
    meta: SacMetadata,
    tile: SacTile,
    tileIndex: number,
    ownerId: number,
    lastRoll: number,
  ): number {
    return this.economySvc.getRent(meta, tile, tileIndex, ownerId, lastRoll);
  }

  private advanceTurn(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    return advanceSacTurn(state, meta);
  }

  private checkWinner(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    if (meta.winnerId != null) return state;
    const players = Array.isArray(state.players) ? state.players : [];
    const alive = players
      .map((p) => p?.id)
      .filter(
        (id): id is number => typeof id === 'number' && Number.isFinite(id),
      )
      .filter((id) => !meta.statuses?.eliminated?.[id]);
    if (alive.length === 1) {
      const winnerId = alive[0];
      const nextMeta: SacMetadata = { ...meta, winnerId };
      const next = {
        ...state,
        metadata: { ...(state.metadata ?? {}), ...nextMeta },
      };
      return this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, winnerId)} remporte la partie !`,
      );
    }
    return state;
  }

  private getMeta(state: GameStateEntity): SacMetadata {
    return (state.metadata ?? {}) as SacMetadata;
  }

}










