package com.lemondelila.client;

import com.lemondelila.client.settings.AppSettings;
import com.lemondelila.client.settings.AppSettingsService;
import com.lemondelila.framework.core.context.ApplicationContext;
import com.lemondelila.framework.core.module.FrameworkBootstrap;
import com.lemondelila.framework.ui.LilaFrame;

import javax.swing.JOptionPane;
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
                    AppSettings settings = settingsService.current();
                    if (!settings.confirmOnExit() || confirmExit(frame)) {
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

    private static boolean confirmExit(LilaFrame frame) {
        int choice = JOptionPane.showConfirmDialog(
                frame,
                "Voulez-vous vraiment quitter Le Monde de Lila ?",
                "Quitter l'application",
                JOptionPane.YES_NO_OPTION,
                JOptionPane.QUESTION_MESSAGE
        );
        return choice == JOptionPane.YES_OPTION;
    }
}
