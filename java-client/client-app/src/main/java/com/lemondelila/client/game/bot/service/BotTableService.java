package com.lemondelila.client.game.bot.service;

import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.game.bot.event.AddBotRequested;
import com.lemondelila.client.game.bot.event.RemoveBotRequested;
import com.lemondelila.client.game.room.model.BotState;
import com.lemondelila.client.game.room.model.TableState;

import java.util.List;
import java.util.Objects;

/**
 * Service m├®tier charg├® de g├®rer les intentions et messages autour des bots.
 * Il d├©cide quel bot retirer, publie les commandes et construit les annonces associ├®es.
 */
public final class BotTableService {

    private final DomainEventBus eventBus;

    public BotTableService(DomainEventBus eventBus) {
        this.eventBus = Objects.requireNonNull(eventBus, "eventBus");
    }

    public BotActionResult requestAddBot(Integer roomId, boolean gameStarted) {
        if (roomId == null) {
            return BotActionResult.failure("Aucune table selectionnee pour ajouter un bot.");
        }
        if (gameStarted) {
            return BotActionResult.failure("La partie a commençé : impossible d'ajouter un bot.");
        }
        eventBus.publish(new AddBotRequested(roomId, null));
        return BotActionResult.success(null);
    }

    public BotActionResult requestRemoveBot(Integer roomId, boolean gameStarted, List<BotState> bots) {
        if (roomId == null) {
            return BotActionResult.failure("Aucune table sélectionnée pour retirer un bot.");
        }
        if (gameStarted) {
            return BotActionResult.failure("La partie a commençé : impossible de retirer un bot.");
        }
        Integer targetId = selectBotId(bots);
        if (targetId == null) {
            return BotActionResult.failure("Aucun bot a retirer.");
        }
        eventBus.publish(new RemoveBotRequested(roomId, targetId));
        return BotActionResult.success(null);
    }

    public String addedMessage(BotState bot) {
        String name = bot == null || bot.name() == null || bot.name().isBlank() ? "Bot" : bot.name();
        return name + " a rejoint la table.";
    }

    public String removedMessage(Integer botId, String fallback, TableState tableState) {
        String name = resolveBotName(botId, fallback, tableState);
        return name + " a quitte la table.";
    }

    private static Integer selectBotId(List<BotState> bots) {
        if (bots == null || bots.isEmpty()) {
            return null;
        }
        for (int i = bots.size() - 1; i >= 0; i--) {
            BotState candidate = bots.get(i);
            if (candidate != null && candidate.id() != null) {
                return candidate.id();
            }
        }
        return null;
    }

    private static String resolveBotName(Integer botId, String fallback, TableState tableState) {
        if (botId != null && tableState != null) {
            return tableState.bots().stream()
                    .filter(b -> b.id() != null && Objects.equals(b.id(), botId))
                    .map(b -> b.name() == null || b.name().isBlank() ? "Bot" : b.name())
                    .findFirst()
                    .orElse(fallback == null || fallback.isBlank() ? "Bot" : fallback);
        }
        return fallback == null || fallback.isBlank() ? "Bot" : fallback;
    }

    public static final class BotActionResult {
        private final boolean success;
        private final String message;

        private BotActionResult(boolean success, String message) {
            this.success = success;
            this.message = message;
        }

        public boolean success() {
            return success;
        }

        public String message() {
            return message;
        }

        private static BotActionResult success(String message) {
            return new BotActionResult(true, message);
        }

        private static BotActionResult failure(String message) {
            return new BotActionResult(false, message);
        }
    }
}
