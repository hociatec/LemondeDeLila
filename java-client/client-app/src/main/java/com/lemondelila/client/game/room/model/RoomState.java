package com.lemondelila.client.game.room.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

public final class RoomState {

    private Integer id;
    private String name;
    private String status;
    private String gameType;
    private int maxPlayers;
    private Owner owner;
    private final List<PlayerState> players = new ArrayList<>();
    private final List<BotState> bots = new ArrayList<>();
    private Counts counts = new Counts(0, 0);

    public Integer id() { return id; }
    public String name() { return name; }
    public String status() { return status; }
    public String gameType() { return gameType; }
    public int maxPlayers() { return maxPlayers; }
    public Optional<Owner> owner() { return Optional.ofNullable(owner); }
    public List<PlayerState> players() { return Collections.unmodifiableList(players); }
    public List<BotState> bots() { return Collections.unmodifiableList(bots); }
    public Counts counts() { return counts; }

    public RoomState withId(Integer id) { this.id = id; return this; }
    public RoomState withName(String name) { this.name = name; return this; }
    public RoomState withStatus(String status) { this.status = status; return this; }
    public RoomState withGameType(String gameType) { this.gameType = gameType; return this; }
    public RoomState withMaxPlayers(int maxPlayers) { this.maxPlayers = maxPlayers; return this; }
    public RoomState withOwner(Owner owner) { this.owner = owner; return this; }
    public RoomState withCounts(Counts counts) { this.counts = counts; return this; }

    public RoomState replacePlayers(List<PlayerState> list) {
        players.clear();
        if (list != null) {
            players.addAll(list);
        }
        return this;
    }

    public RoomState replaceBots(List<BotState> list) {
        bots.clear();
        if (list != null) {
            bots.addAll(list);
        }
        return this;
    }

    public record Owner(Integer id, String username) { }
    public record Counts(int players, int spectators) { }
}
