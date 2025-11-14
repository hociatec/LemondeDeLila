package com.lemondelila.client.social.controller;

import com.lemondelila.client.messaging.service.UserRelationshipService;
import com.lemondelila.client.messaging.service.UserRelationshipService.Relationship;
import com.lemondelila.client.framework.core.di.Inject;

import java.util.List;
import java.util.Objects;

/**
 * Provides an MVC-friendly facade around {@link UserRelationshipService} so that the social views
 * do not have to manipulate services directly.
 */
public final class SocialRelationshipsController {

    private final UserRelationshipService relationshipService;

    @Inject
    public SocialRelationshipsController(UserRelationshipService relationshipService) {
        this.relationshipService = Objects.requireNonNull(relationshipService, "relationshipService");
    }

    public List<Relationship> loadFriends() {
        return List.copyOf(relationshipService.friends());
    }

    public List<Relationship> loadBlocked() {
        return List.copyOf(relationshipService.blocked());
    }

    public void removeFriend(int userId) {
        relationshipService.removeFriend(userId);
    }

    public void unblock(int userId) {
        relationshipService.unblock(userId);
    }
}

