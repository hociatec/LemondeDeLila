package com.lemondelila.client;

import com.lemondelila.client.settings.service.AppSettingsService;
import com.lemondelila.client.application.AppBranding;
import com.lemondelila.client.application.view.dialog.ConfirmExitDialog;
import com.lemondelila.client.home.view.HomeScreen;
import com.lemondelila.client.framework.access.AccessibilityPreferences;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.FrameworkBootstrap;
import com.lemondelila.client.framework.ui.LilaFrame;
import com.lemondelila.client.framework.ui.lifecycle.ShutdownManager;

import javax.swing.InputMap;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.UIManager;
import javax.swing.WindowConstants;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

public final class AppLauncher {

    private AppLauncher() {
    }

    public static void main(String[] args) {
        configureNativeLibraries();
        disableSpaceActivationForButtons();

        FrameworkBootstrap bootstrap = FrameworkBootstrap.load();
        ApplicationContext context = bootstrap.launch();

        Runtime.getRuntime().addShutdownHook(new Thread(() -> bootstrap.shutdown(context)));
        AppSettingsService settingsService = context.get(AppSettingsService.class);
        AppBranding branding = context.get(AppBranding.class);
        ShutdownManager shutdownManager = context.get(ShutdownManager.class);
        AccessibilityPreferences.setExtraDescriptionsEnabled(settingsService.current().extraDescriptionsEnabled());
        settingsService.listen(settings -> AccessibilityPreferences.setExtraDescriptionsEnabled(settings.extraDescriptionsEnabled()));

        SwingUtilities.invokeLater(() -> {
            LilaFrame frame = context.get(LilaFrame.class);
            frame.setDefaultCloseOperation(WindowConstants.DO_NOTHING_ON_CLOSE);
            shutdownManager.addHook(() -> {
                frame.setVisible(false);
                frame.dispose();
            });
            frame.addWindowListener(new WindowAdapter() {
                @Override
                public void windowClosing(WindowEvent e) {
                    if (!settingsService.current().confirmOnExit()
                            || ConfirmExitDialog.show(frame, branding.applicationName())) {
                        shutdownManager.requestExit();
                    }
                }
            });
            frame.setVisible(true);
            frame.screenManager().show(HomeScreen.ID);
        });
    }

    private static void configureNativeLibraries() {
        String os = System.getProperty("os.name", "").toLowerCase();
        if (!os.contains("win")) {
            return;
        }
        boolean is64 = System.getProperty("os.arch", "").contains("64");
        Path base = Paths.get("java-client", "libs", "windows");
        if (!Files.isDirectory(base)) {
            base = Paths.get("libs", "windows");
        }
        if (!Files.isDirectory(base)) {
            return;
        }
        Path archDir = base.resolve(is64 ? "x64" : "x86");
        Path dllDir = Files.isDirectory(archDir) ? archDir : base;
        System.setProperty("lila.native.dir", dllDir.toAbsolutePath().toString());
        System.setProperty("lila.native.log.dir", dllDir.toAbsolutePath().toString());
    }

    private static void disableSpaceActivationForButtons() {
        Runnable task = () -> {
            KeyStroke pressed = KeyStroke.getKeyStroke("pressed SPACE");
            KeyStroke released = KeyStroke.getKeyStroke("released SPACE");
            KeyStroke typed = KeyStroke.getKeyStroke("SPACE");

            removeSpaceBinding((InputMap) UIManager.get("Button.focusInputMap"), pressed, released, typed);
            removeSpaceBinding((InputMap) UIManager.get("Button.ancestorInputMap"), pressed, released, typed);
            UIManager.put("Button.spacePressesDefaultButton", Boolean.FALSE);
        };
        if (SwingUtilities.isEventDispatchThread()) {
            task.run();
        } else {
            SwingUtilities.invokeLater(task);
        }
    }

    private static void removeSpaceBinding(InputMap map, KeyStroke pressed, KeyStroke released, KeyStroke typed) {
        if (map == null) {
            return;
        }
        map.remove(pressed);
        map.remove(released);
        map.remove(typed);
    }
}



