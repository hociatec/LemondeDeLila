package com.lemondelila.client.game.core.controller;

import com.lemondelila.client.game.core.view.GameInteractionComponent;

public interface GameInteractionProvider {
    String gameType();
    GameInteractionComponent create();
}
