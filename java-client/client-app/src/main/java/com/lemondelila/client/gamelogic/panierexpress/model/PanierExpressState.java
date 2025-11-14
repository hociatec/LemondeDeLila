package com.lemondelila.client.gamelogic.panierexpress.model;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

public record PanierExpressState(
        String status,
        String phase,
        int round,
        int turnIndex,
        Integer lastRoll,
        Integer winnerId,
        List<Player> players,
        PendingQuiz pending,
        List<LogEntry> log
) {

    public PanierExpressState {
        Objects.requireNonNull(players, "players");
        Objects.requireNonNull(log, "log");
        players = List.copyOf(players);
        log = List.copyOf(log);
    }

    public Optional<Player> currentPlayer() {
        if (players.isEmpty()) {
            return Optional.empty();
        }
        int index = Math.max(0, Math.min(turnIndex, players.size() - 1));
        return Optional.of(players.get(index));
    }

    public Optional<Player> findPlayerByUsername(String username) {
        if (username == null) {
            return Optional.empty();
        }
        return players.stream()
                .filter(player -> username.equalsIgnoreCase(player.username()))
                .findFirst();
    }

    public boolean isFinished() {
        return "ended".equalsIgnoreCase(status);
    }

    public record Player(int id,
                         String username,
                         int position,
                         List<String> shoppingList,
                         List<String> basket,
                         List<String> inventory,
                         boolean readyForCheckout,
                         int skipTurns,
                         boolean isBot) {

        public Player {
            shoppingList = shoppingList == null ? List.of() : List.copyOf(shoppingList);
            basket = basket == null ? List.of() : List.copyOf(basket);
            inventory = inventory == null ? List.of() : List.copyOf(inventory);
        }
    }

    public record PendingQuiz(int playerId,
                              String question,
                              List<String> choices) {

        public PendingQuiz {
            choices = choices == null ? List.of() : List.copyOf(choices);
        }
    }

    public record LogEntry(String type, String message) {
    }
}
