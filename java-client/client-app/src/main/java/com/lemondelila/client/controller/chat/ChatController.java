package com.lemondelila.client.controller.chat;

import com.lemondelila.client.model.user.ClientSession;
import com.lemondelila.client.service.chat.ChatConnectionFactory;
import com.lemondelila.client.service.settings.AppSettingsService;
import com.lemondelila.client.view.chat.ChatWindow;
import com.lemondelila.framework.ui.dialog.DialogService;

import javax.swing.SwingUtilities;
import java.awt.Window;
import java.util.Objects;

/**
 * Orchestrates chat interactions between the view and the chat services.
 */
public final class ChatController implements AutoCloseable {

    private final ChatConnectionFactory connectionFactory;
    private final AppSettingsService settingsService;
    private final DialogService dialogService;
    private final ClientSession session;

    private ChatWindow chatWindow;

    public ChatController(ChatConnectionFactory connectionFactory,
                          AppSettingsService settingsService,
                          DialogService dialogService,
                          ClientSession session) {
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
        this.settingsService = Objects.requireNonNull(settingsService, "settingsService");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.session = Objects.requireNonNull(session, "session");
    }

    /**
     * Opens (or focuses) the chat window.
     *
     * @param owner window used as dialog parent, may be {@code null}.
     * @return status message for the view to display.
     */
    public String open(Window owner) {
        if (session.authenticated().isEmpty()) {
            dialogService.error("Authentification requise", "Veuillez vous reconnecter pour acceder au tchat.");
            return "Connexion requise pour ouvrir le tchat.";
        }
        if (!settingsService.current().chatEnabled()) {
            dialogService.info("Tchat desactive", "Activez le tchat dans les options pour l'utiliser.");
            return "Tchat desactive.";
        }
        if (chatWindow == null || !chatWindow.isDisplayable()) {
            chatWindow = new ChatWindow(owner, connectionFactory, settingsService, dialogService);
        }
        ChatWindow window = chatWindow;
        SwingUtilities.invokeLater(() -> {
            window.setVisible(true);
            window.toFront();
        });
        return "Tchat ouvert.";
    }

    @Override
    public void close() {
        if (chatWindow != null) {
            ChatWindow window = chatWindow;
            chatWindow = null;
            SwingUtilities.invokeLater(window::dispose);
        }
    }
}
