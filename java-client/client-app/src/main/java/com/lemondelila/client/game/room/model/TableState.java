package com.lemondelila.client.game.room.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Etat partag�� de la table : room courante, gameType, bots, joueurs.
 */
public final class TableState {

    private Integer roomId;
    private String gameType;
    private final List<BotState> bots = new ArrayList<>();

    public Integer roomId() {
        return roomId;
    }

    public void setRoom(Integer id, String gameType) {
        this.roomId = id;
        this.gameType = gameType;
        bots.clear();
    }

    public void clear() {
        this.roomId = null;
        this.gameType = null;
        bots.clear();
    }

    public String gameType() {
        return gameType;
    }

    public void updateBots(List<BotState> list) {
        bots.clear();
        if (list != null) {
            list.stream().filter(Objects::nonNull).forEach(bots::add);
        }
    }

    public List<BotState> bots() {
        return Collections.unmodifiableList(bots);
    }
}
