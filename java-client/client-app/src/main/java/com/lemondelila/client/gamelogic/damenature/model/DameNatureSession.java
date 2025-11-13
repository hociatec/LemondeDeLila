package com.lemondelila.client.gamelogic.damenature.model;

import com.lemondelila.client.game.model.GameEngine;
import com.lemondelila.client.game.model.GameSession;

import java.util.Optional;

public final class DameNatureSession implements GameSession<DameNatureState> {

    private final int roomId;
    private final DameNatureState state;
    private final DameNatureState.Player self;
    private final int selfIndex;
    private final GameEngine.Score score;

    public DameNatureSession(int roomId,
                             DameNatureState state,
                             DameNatureState.Player self,
                             int selfIndex,
                             GameEngine.Score score) {
        this.roomId = roomId;
        this.state = state;
        this.self = self;
        this.selfIndex = selfIndex;
        this.score = score;
    }

    public DameNatureState.Player self() {
        return self;
    }

    public int selfIndex() {
        return selfIndex;
    }

    public Optional<GameEngine.Score> scoreValue() {
        return Optional.ofNullable(score);
    }

    @Override
    public String gameType() {
        return state != null && state.type() != null ? state.type() : "dame-nature";
    }

    @Override
    public int roomId() {
        return roomId;
    }

    @Override
    public DameNatureState state() {
        return state;
    }

    @Override
    public boolean finished() {
        return state != null && "ended".equalsIgnoreCase(state.status());
    }

    @Override
    public Optional<GameEngine.Score> score() {
        return Optional.ofNullable(score);
    }
}
