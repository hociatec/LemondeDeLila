package com.lemondelila.client.social.view;

import com.lemondelila.client.messaging.service.UserRelationshipService;

final class SocialDisplayUtils {

    private SocialDisplayUtils() {
    }

    static String displayName(UserRelationshipService.Relationship relation) {
        if (relation == null) {
            return "Utilisateur inconnu";
        }
        String username = relation.username();
        if (username == null || username.isBlank()) {
            return "Utilisateur #" + relation.id();
        }
        return username;
    }

    static String safeUsername(String value) {
        return value == null || value.isBlank() ? "Utilisateur" : value;
    }

    static String shorten(String text, int maxLength) {
        if (text == null) {
            return "";
        }
        String trimmed = text.replaceAll("\\s+", " ").trim();
        if (trimmed.length() <= maxLength) {
            return trimmed;
        }
        int end = Math.max(0, maxLength - 3);
        return trimmed.substring(0, end) + "...";
    }
}

