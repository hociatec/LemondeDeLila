package com.lemondelila.framework.ui;

import com.lemondelila.framework.ui.screen.ScreenManager;

import javax.swing.JFrame;
import javax.swing.WindowConstants;
import java.awt.BorderLayout;

public final class LilaFrame extends JFrame {

    private final ScreenManager screenManager;

    public LilaFrame(ScreenManager screenManager) {
        super("Le Monde de Lila");
        this.screenManager = screenManager;
        setDefaultCloseOperation(WindowConstants.EXIT_ON_CLOSE);
        setLayout(new BorderLayout());
        add(screenManager.getContainer(), BorderLayout.CENTER);
        setSize(1024, 720);
        setLocationRelativeTo(null);
    }

    public ScreenManager screenManager() {
        return screenManager;
    }
}

