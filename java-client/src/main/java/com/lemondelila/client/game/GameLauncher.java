package com.lemondelila.client.game;

import com.lemondelila.client.config.ClientConfig;
import com.lemondelila.client.menu.model.GameSummary;
import com.lemondelila.client.session.service.SessionService;
import com.lemondelila.client.ui.SwingAuthView;

import javax.swing.*;

public class GameLauncher {

    public static void launch(SwingAuthView authView, String category, String subCategory, GameSummary game, SessionService sessionService, ClientConfig config) {
        // TODO: This should be connected to a dynamic room selection UI.
        String roomId = "1";
        // TODO: The player index should be determined dynamically.
        int playerIndex = 0;

        String gameName = game.name();
        String viewClassName = "com.lemondelila.client.game." + category.toLowerCase() + "." + subCategory.toLowerCase() + "." + gameName.toLowerCase() + ".Swing" + gameName + "View";

        try {
            Class<?> viewClass = Class.forName(viewClassName);
            JPanel view = (JPanel) viewClass.getConstructor(SwingAuthView.class, String.class, int.class, SessionService.class, java.net.URI.class)
                    .newInstance(authView, roomId, playerIndex, sessionService, config.apiBaseUri());

            authView.setContentPane(view);
            authView.revalidate();
            authView.repaint();
        } catch (Exception e) {
            e.printStackTrace();
            JOptionPane.showMessageDialog(authView, "Could not launch game: " + gameName, "Error", JOptionPane.ERROR_MESSAGE);
        }
    }
}
