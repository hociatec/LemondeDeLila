package com.lemondelila.client;

import com.lemondelila.client.settings.AppSettingsService;
import com.lemondelila.client.ui.dialog.ConfirmExitDialog;
import com.lemondelila.framework.core.context.ApplicationContext;
import com.lemondelila.framework.core.module.FrameworkBootstrap;
import com.lemondelila.framework.ui.LilaFrame;

import javax.swing.SwingUtilities;
import javax.swing.WindowConstants;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;

public final class AppLauncher {

    private AppLauncher() {
    }

    public static void main(String[] args) {
        FrameworkBootstrap bootstrap = FrameworkBootstrap.load();
        ApplicationContext context = bootstrap.launch();

        Runtime.getRuntime().addShutdownHook(new Thread(() -> bootstrap.shutdown(context)));
        AppSettingsService settingsService = context.get(AppSettingsService.class);

        SwingUtilities.invokeLater(() -> {
            LilaFrame frame = context.get(LilaFrame.class);
            frame.setDefaultCloseOperation(WindowConstants.DO_NOTHING_ON_CLOSE);
            frame.addWindowListener(new WindowAdapter() {
                @Override
                public void windowClosing(WindowEvent e) {
                    if (!settingsService.current().confirmOnExit() || ConfirmExitDialog.show(frame)) {
                        frame.setVisible(false);
                        frame.dispose();
                        System.exit(0);
                    }
                }
            });
            frame.setVisible(true);
            frame.screenManager().show("home");
        });
    }
}
