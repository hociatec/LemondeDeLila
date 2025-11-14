package com.lemondelila.client.social.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.messaging.controller.MessagingController;
import com.lemondelila.client.messaging.model.PrivateMessage;
import com.lemondelila.client.messaging.service.MessagingService;
import com.lemondelila.client.messaging.service.MessagingService.KnownUser;
import com.lemondelila.client.messaging.service.UserRelationshipService;

import java.awt.Window;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

/**
 * Controller dedicated to the Social module messaging dashboard.
 */
public final class SocialMessagesCenterController {

    private static final int DEFAULT_LIMIT = 200;

    private final MessagingService messagingService;
    private final MessagingController messagingController;
    private final UserRelationshipService relationshipService;

    @Inject
    public SocialMessagesCenterController(MessagingService messagingService,
                                          MessagingController messagingController,
                                          UserRelationshipService relationshipService) {
        this.messagingService = Objects.requireNonNull(messagingService, "messagingService");
        this.messagingController = Objects.requireNonNull(messagingController, "messagingController");
        this.relationshipService = Objects.requireNonNull(relationshipService, "relationshipService");
    }

    public CompletableFuture<List<PrivateMessage>> loadInbox() {
        return messagingService.loadInbox(DEFAULT_LIMIT);
    }

    public CompletableFuture<List<PrivateMessage>> loadOutbox() {
        return messagingService.loadOutbox(DEFAULT_LIMIT);
    }

    public CompletableFuture<List<PrivateMessage>> loadDeleted() {
        return messagingService.loadDeleted(DEFAULT_LIMIT);
    }

    public CompletableFuture<PrivateMessage> deleteMessage(String messageId) {
        return messagingController.deleteMessage(messageId);
    }

    public CompletableFuture<PrivateMessage> restoreMessage(String messageId) {
        return messagingController.restoreMessage(messageId);
    }

    public CompletableFuture<KnownUser> lookupUser(String username) {
        return messagingService.lookupUser(username);
    }

    public boolean isBlocked(int userId) {
        return relationshipService.isBlocked(userId);
    }

    public void openConversation(Window owner, int userId, String username) {
        messagingController.openConversation(owner, userId, username);
    }
}

