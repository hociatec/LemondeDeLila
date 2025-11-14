package com.lemondelila.client.gamelogic.damenature.model;

import com.lemondelila.client.game.model.GameEngine;

import java.util.Collections;

public final class DameNatureEngine implements GameEngine<DameNatureState, Object, Integer> {

    @Override
    public String type() {
        return "dame-nature";
    }

    @Override
    public DameNatureState defaultState(Iterable<Integer> players) {
        return new DameNatureState(
                type(),
                "playing",
                0,
                1,
                0,
                12,
                new DameNatureState.Deck(0),
                Collections.emptyList(),
                null,
                Collections.emptyList(),
                new DameNatureState.Catalog(Collections.emptyList(), Collections.emptyList()),
                Collections.emptyMap()
        );
    }

    @Override
    public DameNatureState apply(DameNatureState state, Object action, Integer actor) {
        return state;
    }

    @Override
    public int currentRound(DameNatureState state) {
        return state != null ? Math.max(1, state.round()) : 1;
    }

    @Override
    public Score score(DameNatureState state) {
        if (state == null) {
            return new Score(null, null, 1);
        }
        Integer winner = null;
        if ("ended".equalsIgnoreCase(state.status())) {
            if (state.pollution() >= state.maxPollution()) {
                winner = -1;
            } else if (!state.players().isEmpty()) {
                // choose player with most families
                int best = -1;
                int bestIndex = -1;
                for (int i = 0; i < state.players().size(); i++) {
                    int families = state.players().get(i).books().size();
                    if (families > best) {
                        best = families;
                        bestIndex = i;
                    }
                }
                if (bestIndex >= 0) {
                    winner = state.players().get(bestIndex).id();
                }
            }
        }
        Integer turnPlayer = null;
        if (!state.players().isEmpty() && state.turnIndex() >= 0 && state.turnIndex() < state.players().size()) {
            turnPlayer = state.players().get(state.turnIndex()).id();
        }
        return new Score(winner, turnPlayer, currentRound(state));
    }
}
