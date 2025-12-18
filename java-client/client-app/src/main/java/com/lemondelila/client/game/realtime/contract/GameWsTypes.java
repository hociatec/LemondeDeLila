package com.lemondelila.client.game.realtime.contract;

/**
 * Constantes de types WS pour /ws/game (alignées backend).
 */
public final class GameWsTypes {

    private GameWsTypes() {
    }

    public static final String GAME_JOIN = "game.join";
    public static final String GAME_STATE = "game.state";
    public static final String GAME_ACTIONS = "game.actions";
    public static final String ERROR = "error";
}

