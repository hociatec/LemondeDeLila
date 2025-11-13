package com.lemondelila.client.gamelogic.missionnemesis.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Représentation immuable de l'état de Mission Némésis côté client.
 */
public final class NemesisState {

    private final String type;
    private final List<Player> players;
    private final int turnIndex;
    private final String status;
    private final Integer winnerId;
    private final int round;
    private final List<LogEntry> log;

    NemesisState(String type,
                        List<Player> players,
                        int turnIndex,
                        String status,
                        Integer winnerId,
                        int round,
                        List<LogEntry> log) {
        this.type = Objects.requireNonNull(type, "type");
        this.players = Collections.unmodifiableList(new ArrayList<>(players));
        this.turnIndex = turnIndex;
        this.status = status;
        this.winnerId = winnerId;
        this.round = round;
        this.log = Collections.unmodifiableList(new ArrayList<>(log));
    }

    public String type() {
        return type;
    }

    public List<Player> players() {
        return players;
    }

    public int turnIndex() {
        return turnIndex;
    }

    public String status() {
        return status;
    }

    public Integer winnerId() {
        return winnerId;
    }

    public int round() {
        return round;
    }

    public List<LogEntry> log() {
        return log;
    }

    public record Player(int id,
                         String username,
                         List<Ship> ships,
                         List<Shot> shots,
                         String status,
                         boolean isBot) {

        public Player {
            ships = List.copyOf(ships);
            shots = List.copyOf(shots);
        }
    }

    public record Ship(String name, List<Coordinate> coordinates, boolean[] hits) {
        public Ship {
            coordinates = List.copyOf(coordinates);
            hits = hits.clone();
        }
    }

    public record Coordinate(int x, int y) {
    }

    public record Shot(int x, int y, int targetId, String result) {
    }

    public record LogEntry(String type,
                           String message,
                           Integer fromPlayerId,
                           Integer targetPlayerId,
                           Integer x,
                           Integer y,
                           String result) {
    }
}

