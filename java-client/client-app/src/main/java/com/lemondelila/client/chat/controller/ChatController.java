package com.lemondelila.client.chat.controller;

import com.lemondelila.client.chat.events.ChatClosed;
import com.lemondelila.client.chat.events.ChatOpened;
import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.chat.presenter.ChatPresenter;
import com.lemondelila.client.chat.view.ChatWindow;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.settings.service.AppSettingsService;
import com.lemondelila.client.user.model.ClientSession;

import javax.swing.SwingUtilities;
import java.awt.Window;
import java.util.Objects;

/**
 * Orchestrates chat interactions between the view and the chat services.
 */
public final class ChatController implements AutoCloseable {

    private final ChatPresenter presenter;
    private final AppSettingsService settingsService;
    private final DialogService dialogService;
    private final ClientSession session;
    private final DomainEventBus eventBus;

    private ChatWindow chatWindow;
    private boolean opened;

    @Inject
    public ChatController(ChatPresenter presenter,
                          AppSettingsService settingsService,
                          DialogService dialogService,
                          ClientSession session,
                          DomainEventBus eventBus) {
        this.presenter = Objects.requireNonNull(presenter, "presenter");
        this.settingsService = Objects.requireNonNull(settingsService, "settingsService");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.session = Objects.requireNonNull(session, "session");
        this.eventBus = Objects.requireNonNull(eventBus, "eventBus");
    }

    /**
     * Opens (or focuses) the chat window.
     *
     * @param owner window used as dialog parent, may be {@code null}.
     * @return résultat pour l'UI.
     */
    public ControllerResult open(Window owner) {
        if (session.authenticated().isEmpty()) {
            dialogService.error(
                    Internationalization.text("chat.auth.required.title"),
                    Internationalization.text("chat.auth.required.body"));
            return ControllerResult.status(Internationalization.text("chat.status.auth"));
        }
        if (!settingsService.current().chatEnabled()) {
            dialogService.info(
                    Internationalization.text("chat.disabled.title"),
                    Internationalization.text("chat.disabled.body"));
            return ControllerResult.status(Internationalization.text("chat.status.disabled"));
        }
        if (chatWindow == null || !chatWindow.isDisplayable()) {
            chatWindow = new ChatWindow(owner, presenter, settingsService, dialogService);
            opened = false;
        }
        ChatWindow window = chatWindow;
        SwingUtilities.invokeLater(() -> {
            window.setVisible(true);
            window.toFront();
        });
        if (!opened) {
            String username = session.authenticated().map(ClientSession.AuthState::username).orElse(null);
            eventBus.publish(new ChatOpened(username));
            opened = true;
        }
        return ControllerResult.status(Internationalization.text("chat.status.open"));
    }

    @Override
    public void close() {
        if (chatWindow != null) {
            ChatWindow window = chatWindow;
            chatWindow = null;
            SwingUtilities.invokeLater(window::dispose);
        }
        if (opened) {
            String username = session.authenticated().map(ClientSession.AuthState::username).orElse(null);
            eventBus.publish(new ChatClosed(username));
            opened = false;
        }
    }
}
