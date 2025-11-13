package com.lemondelila.client.game.model;

/**
 * Minimal contract for client-side game engines.
 *
 * @param <S> state type handled by the engine
 * @param <A> action type accepted by the engine
 * @param <P> player identifier type
 */
public interface GameEngine<S, A, P> {

    /** Identifies the game (for example {@code mission-nemesis}). */
    String type();

    /** Builds the initial state for the provided players. */
    S defaultState(Iterable<P> players);

    /** Applies an action and returns the updated state. */
    S apply(S state, A action, P actor);

    /** Returns the current round number derived from the state. */
    int currentRound(S state);

    /** Computes a score or summary that the UI can display. */
    Score score(S state);

    /** Standard representation of a game score. */
    record Score(Integer winnerId, Integer turnPlayerId, int rounds) {
    }
}
