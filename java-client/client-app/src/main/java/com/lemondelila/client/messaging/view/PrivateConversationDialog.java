package com.lemondelila.client.messaging.view;

import com.lemondelila.client.messaging.model.PrivateMessage;
import com.lemondelila.client.messaging.service.MessagingService;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.presence.model.PresencePlayer;

import javax.swing.JDialog;
import java.awt.BorderLayout;
import java.awt.Window;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.util.List;
import java.util.Objects;

public final class PrivateConversationDialog extends JDialog {

    private final PresencePlayer target;
    private final MessagingService messagingService;
    private final DialogService dialogService;
    private final Runnable onDispose;
    private final PrivateConversationView view;

    public PrivateConversationDialog(Window owner,
                                     PresencePlayer target,
                                     MessagingService messagingService,
                                     DialogService dialogService,
                                     Runnable onDispose) {
        super(owner, "Conversation avec " + target.username(), ModalityType.MODELESS);
        this.target = Objects.requireNonNull(target, "target");
        this.messagingService = Objects.requireNonNull(messagingService, "messagingService");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.onDispose = Objects.requireNonNull(onDispose, "onDispose");
        this.view = new PrivateConversationView(target.username());

        setDefaultCloseOperation(DISPOSE_ON_CLOSE);
        setLayout(new BorderLayout());
        add(view.component(), BorderLayout.CENTER);

        view.onSend(this::sendCurrentMessage);

        addWindowListener(new WindowAdapter() {
            @Override
            public void windowClosed(WindowEvent e) {
                onDispose.run();
            }
        });

        setSize(420, 360);
        setLocationRelativeTo(owner);
        loadConversation();
    }

    public void requestInputFocus() {
        view.focusInput();
    }

    private void loadConversation() {
        view.setStatus("Chargement en cours...");
        messagingService.loadConversation(target.id(), 200)
                .whenComplete((messages, error) ->
                        javax.swing.SwingUtilities.invokeLater(() -> {
                            if (error != null) {
                                dialogService.error("Messagerie privee", error.getMessage());
                                view.setStatus("Erreur de chargement.");
                                return;
                            }
                            renderMessages(messages);
                            view.setStatus(messages.isEmpty()
                                    ? "Aucun message pour le moment."
                                    : "Conversation chargee.");
                        }));
    }

    private void renderMessages(List<PrivateMessage> messages) {
        view.renderMessages(messages);
    }

    private void sendCurrentMessage() {
        String text = view.currentInput().trim();
        if (text.isEmpty()) {
            return;
        }
        view.setSendEnabled(false);
        messagingService.sendMessage(target.id(), text)
                .whenComplete((message, error) ->
                        javax.swing.SwingUtilities.invokeLater(() -> {
                            view.setSendEnabled(true);
                            if (error != null) {
                                dialogService.error("Messagerie privee", error.getMessage());
                                return;
                            }
                            view.appendMessage(message);
                            view.clearInput();
                            view.setStatus("Message envoye.");
                        }));
    }
}
