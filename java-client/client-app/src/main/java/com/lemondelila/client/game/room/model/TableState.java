package com.lemondelila.client.game.room.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Etat partage de la table : room courante, gameType, bots, joueurs.
 */
public final class TableState {

    private Integer roomId;
    private String gameType;
    private String status;
    private boolean isPrivate = false;
    private final List<BotState> bots = new ArrayList<>();
    private final List<PlayerState> players = new ArrayList<>();
    private final List<Integer> participantOrder = new ArrayList<>();
    private boolean started;
    private int turnIndex = -1;
    private int turnRound = 1;
    private int turnDirection = 1;
    private Integer currentPlayerId = null;

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

    public List<Integer> participantOrder() {
        return Collections.unmodifiableList(participantOrder);
    }

    public int playerCountIncludingLocalParticipant() {
        int count = players.size();
        if (roomId != null) {
            count = Math.max(1, count);
        }
        return count;
    }

    public int participantCountIncludingLocalParticipant() {
        return playerCountIncludingLocalParticipant() + bots.size();
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

    public Integer currentPlayerId() {
        return currentPlayerId;
    }

    public void setRoom(Integer id, String gameType) {
        if (Objects.equals(this.roomId, id) && Objects.equals(this.gameType, gameType)) {
            return;
        }
        this.roomId = id;
        this.gameType = gameType;
        this.status = null;
        this.started = false;
        this.isPrivate = false;
        bots.clear();
        players.clear();
        participantOrder.clear();
        this.turnIndex = -1;
        this.turnRound = 1;
        this.turnDirection = 1;
        this.currentPlayerId = null;
    }

    public void clear() {
        this.roomId = null;
        this.gameType = null;
        this.status = null;
        this.started = false;
        this.isPrivate = false;
        bots.clear();
        players.clear();
        participantOrder.clear();
        this.turnIndex = -1;
        this.turnRound = 1;
        this.turnDirection = 1;
        this.currentPlayerId = null;
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

    public void updateParticipantOrder(List<Integer> order) {
        participantOrder.clear();
        if (order != null) {
            order.stream().filter(Objects::nonNull).forEach(participantOrder::add);
        }
    }

    public void updateStatus(String status) {
        this.status = status;
        if (status == null || status.isBlank()) {
            return;
        }
        String normalized = status.trim().toLowerCase(Locale.ROOT);
        if ("open".equals(normalized)
                || "setup".equals(normalized)
                || "ouvert".equals(normalized)
                || "preparing".equals(normalized)
                || "pending".equals(normalized)) {
            this.started = false;
            return;
        }
        this.started = true;
    }

    public void updatePrivacy(boolean isPrivate) {
        this.isPrivate = isPrivate;
    }

    public void updateTurn(int round, int index, int direction) {
        this.turnRound = round;
        this.turnIndex = index;
        this.turnDirection = direction == -1 ? -1 : 1;
        this.currentPlayerId = resolveCurrentPlayerId(index);
    }

    public void updateCurrentPlayerId(Integer currentPlayerId) {
        this.currentPlayerId = currentPlayerId;
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

    private Integer resolveCurrentPlayerId(int index) {
        if (index >= 0 && index < participantOrder.size()) {
            return participantOrder.get(index);
        }
        int totalPlayers = players.size();
        if (index >= 0 && index < totalPlayers) {
            return players.get(index).id();
        }
        int botIdx = index - totalPlayers;
        if (botIdx >= 0 && botIdx < bots.size()) {
            return bots.get(botIdx).id();
        }
        return null;
    }
}
