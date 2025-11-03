package com.lemondelila.client;

import com.lemondelila.client.config.ClientConfig;
import com.lemondelila.client.history.HistoryModule;
import com.lemondelila.client.session.SessionModule;
import com.lemondelila.client.user.UserModule;

import javax.swing.SwingUtilities;

/**
 * Point d'entree de l'application Swing.
 * L'initialisation est decouplee pour faciliter les futurs modules.
 */
public final class AppLauncher {

    private AppLauncher() {
        // Utility class
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            ClientConfig config = ClientConfig.load();
            HistoryModule historyModule = new HistoryModule();
            SessionModule sessionModule = new SessionModule();
            new UserModule(config, historyModule, sessionModule).start();
        });
    }
}
