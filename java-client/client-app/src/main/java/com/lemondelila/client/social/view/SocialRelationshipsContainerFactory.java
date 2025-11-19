package com.lemondelila.client.social.view;

import java.util.function.Consumer;

public interface SocialRelationshipsContainerFactory {

    SocialRelationshipsContainer create(Consumer<String> statusUpdater, Runnable onEscape);
}
