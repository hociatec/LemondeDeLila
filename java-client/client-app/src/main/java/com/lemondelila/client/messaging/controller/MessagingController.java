package com.lemondelila.client.messaging.controller;

import com.lemondelila.client.messaging.model.PrivateMessage;
import com.lemondelila.client.messaging.service.MessagingService;
import com.lemondelila.client.messaging.service.UserRelationshipService;
import com.lemondelila.client.messaging.view.PrivateConversationDialog;
import com.lemondelila.client.user.model.ClientSession;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.presence.model.PresencePlayer;

import javax.swing.SwingUtilities;
import java.awt.Window;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CompletableFuture;

public final class MessagingController {

    private final MessagingService messagingService;
    private final UserRelationshipService relationshipService;
    private final DialogService dialogService;
    private final ClientSession session;
    private final Map<Integer, PrivateConversationDialog> openDialogs = new ConcurrentHashMap<>();

    @Inject
    public MessagingController(MessagingService messagingService,
                               UserRelationshipService relationshipService,
                               DialogService dialogService,
                               ClientSession session) {
        this.messagingService = Objects.requireNonNull(messagingService, "messagingService");
        this.relationshipService = Objects.requireNonNull(relationshipService, "relationshipService");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.session = Objects.requireNonNull(session, "session");
    }

    public void openConversation(Window owner, PresencePlayer player) {
        if (player == null || player.id() <= 0) {
            return;
        }
        if (session.authenticated().isEmpty()) {
            dialogService.error("Messagerie privee", "Connectez-vous pour envoyer un message.");
            return;
        }
        String currentUser = session.authenticated().map(ClientSession.AuthState::username).orElse(null);
        if (currentUser != null && currentUser.equalsIgnoreCase(player.username())) {
            dialogService.info("Messagerie privee", "Vous ne pouvez pas discuter avec vous-meme.");
            return;
        }
        if (relationshipService.isBlocked(player.id())) {
            dialogService.info("Messagerie privee", player.username() + " est bloque. Debloquez-le pour discuter.");
            return;
        }
        PrivateConversationDialog dialog = openDialogs.get(player.id());
        if (dialog == null || !dialog.isDisplayable()) {
            dialog = new PrivateConversationDialog(owner, player, messagingService, dialogService,
                    () -> openDialogs.remove(player.id()));
            openDialogs.put(player.id(), dialog);
        }
        PrivateConversationDialog finalDialog = dialog;
        SwingUtilities.invokeLater(() -> {
            finalDialog.setLocationRelativeTo(owner);
            finalDialog.setVisible(true);
            finalDialog.toFront();
            finalDialog.requestInputFocus();
        });
    }

    public void openConversation(Window owner, int userId, String username) {
        PresencePlayer phantom = new PresencePlayer(userId, username == null ? ("Utilisateur #" + userId) : username, List.of());
        openConversation(owner, phantom);
    }

    public CompletableFuture<PrivateMessage> sendMessage(int recipientId, String text) {
        return messagingService.sendMessage(recipientId, text);
    }

    public CompletableFuture<java.util.List<PrivateMessage>> loadConversation(int userId) {
        return messagingService.loadConversation(userId, 200);
    }
}
