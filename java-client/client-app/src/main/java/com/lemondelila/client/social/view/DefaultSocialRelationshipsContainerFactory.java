package com.lemondelila.client.social.view;

import com.lemondelila.client.social.controller.SocialRelationshipsController;

import javax.inject.Inject;
import java.util.Objects;
import java.util.function.Consumer;

public final class DefaultSocialRelationshipsContainerFactory implements SocialRelationshipsContainerFactory {

    private final SocialRelationshipsController relationshipsController;

    @Inject
    public DefaultSocialRelationshipsContainerFactory(SocialRelationshipsController relationshipsController) {
        this.relationshipsController = Objects.requireNonNull(relationshipsController, "relationshipsController");
    }

    @Override
    public SocialRelationshipsContainer create(Consumer<String> statusUpdater, Runnable onEscape) {
        SocialRelationshipsContainer container = new SocialRelationshipsContainer(relationshipsController, statusUpdater);
        container.setOnEscape(onEscape);
        return container;
    }
}
