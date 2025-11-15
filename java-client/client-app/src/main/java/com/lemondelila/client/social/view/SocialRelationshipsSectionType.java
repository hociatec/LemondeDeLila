package com.lemondelila.client.social.view;

import com.lemondelila.client.messaging.service.UserRelationshipService.Relationship;
import com.lemondelila.client.social.controller.SocialRelationshipsController;

import java.util.function.BiFunction;

public enum SocialRelationshipsSectionType {
    FRIENDS(
            "Liste d'amis",
            "Aucun ami enregistré.",
            "%d ami(s) enregistré(s).",
            "Retirer",
            "Sélectionnez un ami à retirer.",
            (controller, relation) -> {
                controller.removeFriend(relation.id());
                return SocialDisplayUtils.displayName(relation) + " retiré de vos amis.";
            }
    ),
    BLOCKED(
            "Amis bloqués",
            "Aucun utilisateur bloqué.",
            "%d utilisateur(s) bloqué(s).",
            "Débloquer",
            "Sélectionnez un utilisateur à débloquer.",
            (controller, relation) -> {
                controller.unblock(relation.id());
                return SocialDisplayUtils.displayName(relation) + " est débloqué.";
            }
    );

    private final String title;
    private final String emptySummary;
    private final String summaryFormat;
    private final String actionLabel;
    private final String selectionPrompt;
    private final BiFunction<SocialRelationshipsController, Relationship, String> actionHandler;

    SocialRelationshipsSectionType(String title,
                                   String emptySummary,
                                   String summaryFormat,
                                   String actionLabel,
                                   String selectionPrompt,
                                   BiFunction<SocialRelationshipsController, Relationship, String> actionHandler) {
        this.title = title;
        this.emptySummary = emptySummary;
        this.summaryFormat = summaryFormat;
        this.actionLabel = actionLabel;
        this.selectionPrompt = selectionPrompt;
        this.actionHandler = actionHandler;
    }

    public String title() {
        return title;
    }

    public String emptySummary() {
        return emptySummary;
    }

    public String summaryForCount(int count) {
        return count == 0 ? emptySummary : summaryFormat.formatted(count);
    }

    public String actionLabel() {
        return actionLabel;
    }

    public String selectionPrompt() {
        return selectionPrompt;
    }

    public String performAction(SocialRelationshipsController controller, Relationship relationship) {
        return actionHandler.apply(controller, relationship);
    }
}
