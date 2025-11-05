package com.lemondedelila.client.games.pong.view;

import com.lemondedelila.client.games.pong.model.PongModel;
import com.lemondedelila.client.mvc.model.GameModel;
import com.lemondedelila.client.mvc.view.AbstractGameView;

import javax.swing.*;
import java.awt.*;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;

public class PongView extends AbstractGameView implements PropertyChangeListener {
    private PongModel model;

    public PongView() {
        setPreferredSize(new Dimension(400, 300));
    }

    @Override
    public void bind(GameModel model) {
        if (model instanceof PongModel) {
            this.model = (PongModel) model;
            model.addPropertyChangeListener(this);
        }
    }

    @Override
    public void paintComponent(Graphics g) {
        super.paintComponent(g);
        g.setColor(Color.BLACK);
        g.fillRect(0, 0, getWidth(), getHeight());
        if (model != null) {
            g.setColor(Color.WHITE);
            g.fillOval(model.getBallX(), model.getBallY(), 10, 10);
        }
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        repaint();
    }
}
