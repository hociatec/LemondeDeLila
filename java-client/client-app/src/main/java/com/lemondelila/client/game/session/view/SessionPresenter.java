package com.lemondelila.client.game.session.view;

import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.game.session.event.LoginFailed;
import com.lemondelila.client.game.session.event.LoginSucceeded;
import com.lemondelila.client.game.session.event.SessionChanged;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Optional;

/**
 * Minimal presenter that logs session transitions.
 * UI panels can subscribe to the same events to update forms/buttons.
 */
public final class SessionPresenter implements AutoCloseable {

    private static final Logger LOGGER = LoggerFactory.getLogger(SessionPresenter.class);
    private final EventSubscriptions subscriptions = new EventSubscriptions();

    public SessionPresenter(DomainEventBus eventBus) {
        subscriptions.subscribe(eventBus, LoginSucceeded.class, e ->
                LOGGER.info("Session ok pour {}", e.username()));
        subscriptions.subscribe(eventBus, LoginFailed.class, e ->
                LOGGER.warn("Connexion refusée : {}", e.reason()));
        subscriptions.subscribe(eventBus, SessionChanged.class, e ->
                LOGGER.info("Session changée: utilisateur={} status={}", e.username().orElse("none"), e.status()));
    }

    @Override
    public void close() {
        subscriptions.close();
    }
}
