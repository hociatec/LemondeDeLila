package com.lemondedelila.client.mvc.view;

import com.lemondedelila.client.mvc.model.GameModel;

import javax.swing.*;

public abstract class AbstractGameView extends JPanel implements GameView {
    @Override
    public void bind(GameModel model) {
        // default no-op; subviews may override
    }
}
