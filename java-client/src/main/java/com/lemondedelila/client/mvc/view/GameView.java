package com.lemondedelila.client.mvc.view;

import com.lemondedelila.client.mvc.model.GameModel;

import javax.swing.*;

public interface GameView {
    JComponent getComponent();
    void bind(GameModel model);
}
