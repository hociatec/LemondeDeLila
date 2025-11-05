package com.lemondedelila.client.mvc.controller;

import com.lemondedelila.client.GameContext;
import com.lemondedelila.client.mvc.model.GameModel;
import com.lemondedelila.client.mvc.view.GameView;

public abstract class AbstractGameController implements GameController {
    protected GameContext ctx;

    @Override
    public void init(GameContext ctx) { this.ctx = ctx; }

    @Override
    public void start() {}

    @Override
    public void stop() {}

    @Override
    public abstract GameModel getModel();

    @Override
    public abstract GameView getView();
}
