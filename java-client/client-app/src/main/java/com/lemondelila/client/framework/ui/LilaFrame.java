package com.lemondelila.client.framework.ui;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.ScreenManager;

import javax.swing.JFrame;
import javax.swing.WindowConstants;
import java.awt.BorderLayout;

public final class LilaFrame extends JFrame {

    private final ScreenManager screenManager;

    @Inject
    public LilaFrame(ScreenManager screenManager, DialogService dialogService) {
        super("Le Monde de Lila");
        this.screenManager = screenManager;
        setDefaultCloseOperation(WindowConstants.EXIT_ON_CLOSE);
        setLayout(new BorderLayout());
        add(screenManager.getContainer(), BorderLayout.CENTER);
        setSize(1024, 720);
        setLocationRelativeTo(null);
        dialogService.attach(this);
    }

    public ScreenManager screenManager() {
        return screenManager;
    }
}
