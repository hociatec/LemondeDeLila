package com.lemondelila.client.game.room.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Etat partage de la table : room courante, gameType, bots, joueurs.
 */
public final class TableState {

    private Integer roomId;
    private String gameType;
    private String status;
    private boolean isPrivate = true;
    private final List<BotState> bots = new ArrayList<>();
    private final List<PlayerState> players = new ArrayList<>();
    private boolean started;
    private int turnIndex = 0;
    private int turnRound = 1;
    private int turnDirection = 1;

    public Integer roomId() {
        return roomId;
    }

    public String gameType() {
        return gameType;
    }

    public String status() {
        return status;
    }

    public boolean isPrivate() { return isPrivate; }

    public boolean started() {
        return started;
    }

    public List<BotState> bots() {
        return Collections.unmodifiableList(bots);
    }

    public List<PlayerState> players() {
        return Collections.unmodifiableList(players);
    }

    public int turnIndex() {
        return turnIndex;
    }

    public int turnRound() {
        return turnRound;
    }

    public int turnDirection() {
        return turnDirection;
    }

    public void setRoom(Integer id, String gameType) {
        this.roomId = id;
        this.gameType = gameType;
        this.status = null;
        this.started = false;
        this.isPrivate = true;
        bots.clear();
        players.clear();
        this.turnIndex = 0;
        this.turnRound = 1;
        this.turnDirection = 1;
    }

    public void clear() {
        this.roomId = null;
        this.gameType = null;
        this.status = null;
        this.started = false;
        this.isPrivate = true;
        bots.clear();
        players.clear();
        this.turnIndex = 0;
        this.turnRound = 1;
        this.turnDirection = 1;
    }

    public void updateBots(List<BotState> list) {
        bots.clear();
        if (list != null) {
            list.stream().filter(Objects::nonNull).forEach(bots::add);
        }
    }

    public void updatePlayers(List<PlayerState> list) {
        players.clear();
        if (list != null) {
            list.stream().filter(Objects::nonNull).forEach(players::add);
        }
    }

    public void updateStatus(String status) {
        this.status = status;
    }

    public void updatePrivacy(boolean isPrivate) {
        this.isPrivate = isPrivate;
    }

    public void updateTurn(int round, int index, int direction) {
        this.turnRound = round;
        this.turnIndex = index;
        this.turnDirection = direction == -1 ? -1 : 1;
    }

    public void markStarted() {
        this.started = true;
    }

    public void addBot(BotState bot) {
        if (bot == null) return;
        // Unicité : si id connu -> unicité par id, sinon par nom.
        boolean exists = bots.stream().anyMatch(b -> {
            if (bot.id() != null && b.id() != null) {
                return Objects.equals(b.id(), bot.id());
            }
            return bot.id() == null && b.id() == null && Objects.equals(normalizeName(b.name()), normalizeName(bot.name()));
        });
        if (!exists) {
            bots.add(bot);
        }
    }

    public void removeBot(Integer botId) {
        bots.removeIf(b -> Objects.equals(b.id(), botId));
    }

    public void removeBotByName(String name) {
        if (name == null) return;
        String target = normalizeName(name);
        bots.removeIf(b -> b.id() == null && Objects.equals(normalizeName(b.name()), target));
    }

    private static String normalizeName(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }
}
