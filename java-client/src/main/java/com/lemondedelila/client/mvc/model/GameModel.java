package com.lemondedelila.client.mvc.model;

import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;

public class GameModel {
    private final PropertyChangeSupport pcs = new PropertyChangeSupport(this);
    private int score;

    public int getScore() { return score; }
    public void setScore(int score) {
        int old = this.score;
        this.score = score;
        pcs.firePropertyChange("score", old, score);
    }

    public void addPropertyChangeListener(PropertyChangeListener l) { pcs.addPropertyChangeListener(l); }
    public void removePropertyChangeListener(PropertyChangeListener l) { pcs.removePropertyChangeListener(l); }
}
