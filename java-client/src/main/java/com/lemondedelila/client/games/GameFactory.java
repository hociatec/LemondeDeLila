package com.lemondedelila.client.games;

import com.lemondedelila.client.GameContext;
import com.lemondedelila.client.mvc.controller.GameController;
import com.lemondedelila.client.mvc.model.GameMetadata;

public interface GameFactory {
    String getId();
    GameMetadata getMetadata();
    GameController create(GameContext ctx);
}
