package com.lemondelila.client.application.view.home;

import com.lemondelila.client.framework.access.NarrationQueue;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.settings.service.AppSettingsService;
import com.lemondelila.client.user.events.LoginSucceeded;
import com.lemondelila.client.user.model.ClientSession;

import java.util.Objects;
import java.util.Optional;
import java.util.function.Supplier;

final class HomeScreenLifecycle {

    private final HomeEventCoordinator eventCoordinator;
    private final Supplier<NarrationQueue> narrationQueueSupplier;
    private final AppSettingsService settingsService;
    private final ClientSession session;
    private final DomainEventBus eventBus;

    private NarrationQueue narrationQueue;

    HomeScreenLifecycle(HomeEventCoordinator eventCoordinator,
                        Supplier<NarrationQueue> narrationQueueSupplier,
                        AppSettingsService settingsService,
                        ClientSession session,
                        DomainEventBus eventBus) {
        this.eventCoordinator = Objects.requireNonNull(eventCoordinator, "eventCoordinator");
        this.narrationQueueSupplier = Objects.requireNonNull(narrationQueueSupplier, "narrationQueueSupplier");
        this.settingsService = Objects.requireNonNull(settingsService, "settingsService");
        this.session = Objects.requireNonNull(session, "session");
        this.eventBus = Objects.requireNonNull(eventBus, "eventBus");
    }

    void onShow(HomeEventCoordinator.Listener listener,
                HomeView view,
                HomeScreen screen) {
        eventCoordinator.subscribe(listener);
        view.showLanding();
        this.narrationQueue = narrationQueueSupplier.get();
        boolean autoLogin = settingsService.current().stayConnected() && session.authenticated().isPresent();
        if (autoLogin) {
            session.authenticated().ifPresent(auth ->
                    eventBus.publish(new LoginSucceeded(auth.username(), auth.token())));
        } else if (narrationQueue != null) {
            narrationQueue.enqueue(screen, "Ecran d'accueil, utilisez les fleches pour naviguer.");
        }
    }

    void onHide() {
        eventCoordinator.unsubscribe();
        narrationQueue = null;
    }
}
