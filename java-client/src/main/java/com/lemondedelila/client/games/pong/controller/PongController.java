package com.lemondedelila.client.games.pong.controller;

import com.lemondedelila.client.GameContext;
import com.lemondedelila.client.games.GameFactory;
import com.lemondedelila.client.mvc.controller.AbstractGameController;
import com.lemondedelila.client.games.pong.model.PongModel;
import com.lemondedelila.client.games.pong.view.PongView;
import com.lemondedelila.client.mvc.model.GameMetadata;
import com.lemondedelila.client.mvc.view.GameView;

import javax.swing.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

public class PongController extends AbstractGameController implements GameFactory {
    private final PongModel model = new PongModel();
    private final PongView view = new PongView();
    private Timer timer;

    // GameFactory methods (so this class can be registered directly)
    @Override public String getId() { return "pong"; }
    @Override public GameMetadata getMetadata() { return new GameMetadata("pong", "Pong", "Classic Pong demo"); }
    @Override public com.lemondedelila.client.mvc.controller.GameController create(com.lemondedelila.client.GameContext ctx) { PongController c = new PongController(); c.init(ctx); return c; }

    @Override
    public void init(GameContext ctx) {
        super.init(ctx);
        view.bind(model);
    }

    @Override
    public void start() {
        timer = new Timer(16, new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                model.update();
                view.repaint();
            }
        });
        timer.start();
    }

    @Override
    public void stop() {
        if (timer != null) timer.stop();
    }

    @Override
    public com.lemondedelila.client.mvc.model.GameModel getModel() { return model; }

    @Override
    public GameView getView() { return view; }
}
