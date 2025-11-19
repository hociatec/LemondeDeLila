package com.lemondelila.client.gamelogic.panierexpress.model;

import com.lemondelila.client.game.model.GameEngine;
import com.lemondelila.client.game.model.GameSession;

import java.util.Optional;

public record PanierExpressSession(int roomId,
                                   PanierExpressState state,
                                   PanierExpressTableInfo table) implements GameSession<PanierExpressState> {

    private static final String GAME_TYPE = "panier-express";

    @Override
    public String gameType() {
        return GAME_TYPE;
    }

    @Override
    public boolean finished() {
        return state != null && state.isFinished();
    }

    @Override
    public Optional<GameEngine.Score> score() {
        return Optional.empty();
    }

    public Optional<PanierExpressTableInfo> tableInfo() {
        return Optional.ofNullable(table);
    }
}
