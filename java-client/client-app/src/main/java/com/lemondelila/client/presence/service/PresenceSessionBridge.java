package com.lemondelila.client.presence.service;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.user.events.LoginSucceeded;
import com.lemondelila.client.user.events.UserLoggedOut;
import com.lemondelila.client.user.model.ClientSession;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Maintient la connexion de présence active pendant toute la durée de la session utilisateur.
 */
public final class PresenceSessionBridge implements AutoCloseable {

    private final PresenceRealtimeService realtimeService;
    private final ClientSession session;
    private final PresenceActivityReporter activityReporter;
    private final EventSubscriptions subscriptions = new EventSubscriptions();
    private final AtomicBoolean running = new AtomicBoolean();

    @Inject
    public PresenceSessionBridge(PresenceRealtimeService realtimeService,
                                 ClientSession session,
                                 DomainEventBus eventBus,
                                 PresenceActivityReporter activityReporter) {
        this.realtimeService = Objects.requireNonNull(realtimeService, "realtimeService");
        this.session = Objects.requireNonNull(session, "session");
        this.activityReporter = Objects.requireNonNull(activityReporter, "activityReporter");
        Objects.requireNonNull(eventBus, "eventBus");
        subscriptions.subscribe(eventBus, LoginSucceeded.class, event -> ensureStarted());
        subscriptions.subscribe(eventBus, UserLoggedOut.class, event -> stop());
        session.authenticated().ifPresent(state -> ensureStarted());
    }

    private void ensureStarted() {
        if (running.compareAndSet(false, true)) {
            realtimeService.start();
        }
        activityReporter.resetToHome();
    }

    private void stop() {
        if (running.compareAndSet(true, false)) {
            realtimeService.stop();
        }
        activityReporter.resetToHome();
    }

    @Override
    public void close() {
        subscriptions.close();
        stop();
    }
}
