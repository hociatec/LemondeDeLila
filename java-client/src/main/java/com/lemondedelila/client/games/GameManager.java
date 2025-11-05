package com.lemondedelila.client.games;

import com.lemondedelila.client.GameContext;
import com.lemondedelila.client.mvc.controller.GameController;

import javax.swing.*;
import java.awt.*;
import java.util.Optional;

public class GameManager {
    private final GameCatalog catalog;
    private final JPanel container; // central panel in the main frame where games are displayed
    private GameController active;
    private final GameContext ctx;

    public GameManager(GameCatalog catalog, JPanel container, GameContext ctx) {
        this.catalog = catalog; this.container = container; this.ctx = ctx;
    }

    public void launch(String gameId) {
        try {
            Optional<GameFactory> f = catalog.getFactory(gameId);
            if (f.isEmpty()) throw new IllegalStateException("No factory for " + gameId);
            GameController controller = f.get().create(ctx);
            controller.init(ctx);
            controller.start();
            SwingUtilities.invokeLater(() -> {
                container.removeAll();
                container.setLayout(new BorderLayout());
                container.add(controller.getView().getComponent(), BorderLayout.CENTER);
                container.revalidate();
                container.repaint();
            });
            if (active != null) active.stop();
            active = controller;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public void stopActive() {
        if (active != null) {
            active.stop();
            active = null;
            SwingUtilities.invokeLater(() -> {
                container.removeAll(); container.revalidate(); container.repaint();
            });
        }
    }
}
