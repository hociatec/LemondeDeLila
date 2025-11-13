package com.lemondelila.client.gamelogic.missionnemesis.model;

import com.lemondelila.client.game.model.GameEngine;
import com.lemondelila.client.game.model.GameSession;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public final class NemesisSession implements GameSession<NemesisState> {

    private final int roomId;
    private final NemesisState state;
    private final NemesisState.Player self;
    private final int selfIndex;
    private final boolean placementRequired;
    private final boolean awaitingCombatTurn;
    private final boolean finished;
    private final GameEngine.Score score;

    public NemesisSession(int roomId,
                                 NemesisState state,
                                 NemesisState.Player self,
                                 int selfIndex,
                                 GameEngine.Score score) {
        this.roomId = roomId;
        this.state = Objects.requireNonNull(state, "state");
        this.self = self;
        this.selfIndex = selfIndex;
        this.score = score;
        this.finished = "ended".equalsIgnoreCase(state.status());
        this.placementRequired = "placement".equalsIgnoreCase(state.status())
                && (self == null || "placing".equalsIgnoreCase(self.status()));
        this.awaitingCombatTurn = "playing".equalsIgnoreCase(state.status())
                && self != null
                && selfIndex >= 0
                && selfIndex == state.turnIndex()
                && "alive".equalsIgnoreCase(self.status());
    }

    @Override
    public String gameType() {
        return state.type();
    }

    @Override
    public int roomId() {
        return roomId;
    }

    @Override
    public NemesisState state() {
        return state;
    }

    public Optional<NemesisState.Player> self() {
        return Optional.ofNullable(self);
    }

    public boolean isPlacementRequired() {
        return placementRequired;
    }

    public boolean isAwaitingCombatTurn() {
        return awaitingCombatTurn;
    }

    @Override
    public boolean finished() {
        return finished;
    }

    public boolean hasPlacedFleet() {
        return self != null && !"placing".equalsIgnoreCase(self.status());
    }

    public Optional<NemesisState.Player> opponentAlive() {
        if (selfIndex < 0) {
            return Optional.empty();
        }
        List<NemesisState.Player> players = state.players();
        for (int i = 0; i < players.size(); i++) {
            if (i == selfIndex) {
                continue;
            }
            NemesisState.Player player = players.get(i);
            if ("alive".equalsIgnoreCase(player.status()) || "ready".equalsIgnoreCase(player.status())) {
                return Optional.of(player);
            }
        }
        return Optional.empty();
    }

    public List<NemesisState.Player> opponents() {
        List<NemesisState.Player> result = new ArrayList<>();
        List<NemesisState.Player> players = state.players();
        for (int i = 0; i < players.size(); i++) {
            if (i == selfIndex) {
                continue;
            }
            result.add(players.get(i));
        }
        return List.copyOf(result);
    }

    @Override
    public Optional<GameEngine.Score> score() {
        return Optional.ofNullable(score);
    }
}
