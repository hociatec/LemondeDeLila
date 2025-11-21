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
    private final List<BotState> bots = new ArrayList<>();
    private final List<PlayerState> players = new ArrayList<>();

    public Integer roomId() {
        return roomId;
    }

    public String gameType() {
        return gameType;
    }

    public List<BotState> bots() {
        return Collections.unmodifiableList(bots);
    }

    public List<PlayerState> players() {
        return Collections.unmodifiableList(players);
    }

    public void setRoom(Integer id, String gameType) {
        this.roomId = id;
        this.gameType = gameType;
        bots.clear();
        players.clear();
    }

    public void clear() {
        this.roomId = null;
        this.gameType = null;
        bots.clear();
        players.clear();
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
}
