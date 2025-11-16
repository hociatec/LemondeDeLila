package com.lemondelila.client.gamelogic.panierexpress.model;

import com.lemondelila.client.gamelogic.panierexpress.dto.PanierExpressStateDto;
import com.lemondelila.client.gamelogic.panierexpress.dto.PanierExpressStateDto.LogEntryDto;
import com.lemondelila.client.gamelogic.panierexpress.dto.PanierExpressStateDto.PendingDto;
import com.lemondelila.client.gamelogic.panierexpress.dto.PanierExpressStateDto.PlayerDto;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public final class PanierExpressStateMapper {

    private PanierExpressStateMapper() {
    }

    public static PanierExpressState fromDto(PanierExpressStateDto dto) throws IOException {
        if (dto == null) {
            throw new IOException("Etat Panier Express invalide");
        }

        String status = dto.status() == null ? "playing" : dto.status();
        String phase = dto.phase() == null ? "turn" : dto.phase();
        int round = dto.round();
        int turnIndex = dto.turnIndex();

        List<PanierExpressState.Player> players = parsePlayers(dto.players());
        PanierExpressState.PendingQuiz pending = parsePending(dto.pending());
        List<PanierExpressState.LogEntry> log = parseLog(dto.log());

        return new PanierExpressState(
                status,
                phase,
                round,
                turnIndex,
                dto.lastRoll(),
                dto.winner(),
                players,
                pending,
                log
        );
    }

    private static List<PanierExpressState.Player> parsePlayers(List<PlayerDto> nodes) {
        if (nodes == null || nodes.isEmpty()) {
            return List.of();
        }
        List<PanierExpressState.Player> players = new ArrayList<>(nodes.size());
        for (PlayerDto entry : nodes) {
            int id = entry == null ? -1 : entry.id();
            String username = entry == null ? "Joueur" : defaultString(entry.username(), "Joueur");
            int position = entry == null ? 1 : entry.position();
            List<String> shopping = entry == null ? List.of() : toImmutable(entry.shoppingList());
            List<String> basket = entry == null ? List.of() : toImmutable(entry.basket());
            List<String> inventory = entry == null ? List.of() : toImmutable(entry.inventory());
            boolean ready = entry != null && entry.readyForCheckout();
            int skip = entry == null ? 0 : entry.skipTurns();
            boolean isBot = entry != null && entry.isBot();
            players.add(new PanierExpressState.Player(
                    id,
                    username,
                    position,
                    shopping,
                    basket,
                    inventory,
                    ready,
                    skip,
                    isBot
            ));
        }
        return List.copyOf(players);
    }

    private static PanierExpressState.PendingQuiz parsePending(PendingDto pending) {
        if (pending == null || pending.type() == null || !"quiz".equalsIgnoreCase(pending.type())) {
            return null;
        }
        List<String> choices = pending.choices() == null ? List.of() : List.copyOf(pending.choices());
        return new PanierExpressState.PendingQuiz(pending.playerId(), pending.question(), choices);
    }

    private static List<PanierExpressState.LogEntry> parseLog(List<LogEntryDto> entries) {
        if (entries == null || entries.isEmpty()) {
            return List.of();
        }
        List<PanierExpressState.LogEntry> logEntries = new ArrayList<>(entries.size());
        for (LogEntryDto entry : entries) {
            if (entry == null) {
                continue;
            }
            logEntries.add(new PanierExpressState.LogEntry(
                    defaultString(entry.type(), "info"),
                    defaultString(entry.message(), "")
            ));
        }
        return List.copyOf(logEntries);
    }

    private static List<String> toImmutable(List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        List<String> copy = new ArrayList<>(values.size());
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                copy.add(value);
            }
        }
        return List.copyOf(copy);
    }

    private static String defaultString(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
