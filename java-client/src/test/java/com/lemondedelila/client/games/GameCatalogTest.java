package com.lemondedelila.client.games;

import com.lemondedelila.client.GameContext;
import com.lemondedelila.client.mvc.controller.GameController;
import com.lemondedelila.client.mvc.model.GameMetadata;
import org.junit.Assert;
import org.junit.Test;

import javax.swing.*;

public class GameCatalogTest {
    @Test
    public void testRegisterAndCreatePlaceholder() {
        GameCatalog catalog = new GameCatalog();
        // register a trivial factory
        GameFactory f = new GameFactory() {
            @Override public String getId() { return "x"; }
            @Override public GameMetadata getMetadata() { return new GameMetadata("x","X","test"); }
            @Override public GameController create(GameContext ctx) { return new GameController() {
                @Override public void init(GameContext ctx) {}
                @Override public void start() {}
                @Override public void stop() {}
                @Override public com.lemondedelila.client.mvc.model.GameModel getModel() { return null; }
                @Override public com.lemondedelila.client.mvc.view.GameView getView() { return null; }
            }; }
        };
        catalog.register(f);
        Assert.assertTrue(catalog.getFactory("x").isPresent());
    }
}
