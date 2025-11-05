package com.lemondedelila.client.mvc.controller;

import com.lemondedelila.client.GameContext;
import com.lemondedelila.client.mvc.model.GameModel;
import com.lemondedelila.client.mvc.view.GameView;

public interface GameController {
    void init(GameContext ctx);
    void start();
    void stop();
    GameModel getModel();
    GameView getView();
}
