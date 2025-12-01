package com.lemondelila.client.home.controller;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.home.view.HomeView;
import com.lemondelila.client.framework.access.NarrationQueue;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.settings.service.AppSettingsService;
import com.lemondelila.client.user.events.LoginSucceeded;
import com.lemondelila.client.user.model.ClientSession;

import javax.swing.SwingUtilities;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.function.Supplier;

public final class HomeScreenLifecycle {

    private final HomeEventCoordinator eventCoordinator;
    private final Supplier<NarrationQueue> narrationQueueSupplier;
    private final AppSettingsService settingsService;
    private final ClientSession session;
    private final DomainEventBus eventBus;
    private final RestClient restClient;
    private final TaskScheduler taskScheduler;

    private NarrationQueue narrationQueue;
    private CompletableFuture<Void> autoLoginTask;

    public HomeScreenLifecycle(HomeEventCoordinator eventCoordinator,
                               Supplier<NarrationQueue> narrationQueueSupplier,
                               AppSettingsService settingsService,
                               ClientSession session,
                               DomainEventBus eventBus,
                               RestClient restClient,
                               TaskScheduler taskScheduler) {
        this.eventCoordinator = Objects.requireNonNull(eventCoordinator, "eventCoordinator");
        this.narrationQueueSupplier = Objects.requireNonNull(narrationQueueSupplier, "narrationQueueSupplier");
        this.settingsService = Objects.requireNonNull(settingsService, "settingsService");
        this.session = Objects.requireNonNull(session, "session");
        this.eventBus = Objects.requireNonNull(eventBus, "eventBus");
        this.restClient = Objects.requireNonNull(restClient, "restClient");
        this.taskScheduler = Objects.requireNonNull(taskScheduler, "taskScheduler");
    }

    public void onShow(HomeEventCoordinator.Listener listener,
                       HomeView view,
                       Screen screen) {
        eventCoordinator.subscribe(listener);
        cancelAutoLogin();
        view.showLanding();
        this.narrationQueue = narrationQueueSupplier.get();
        boolean autoLogin = settingsService.current().stayConnected() && session.authenticated().isPresent();
        if (autoLogin) {
            attemptAutoLogin(view);
        } else if (narrationQueue != null && screen != null && screen.getComponent() != null) {
            narrationQueue.enqueue(screen.getComponent(), Internationalization.text("home.narration.welcome"));
        }
    }

    public void onHide() {
        eventCoordinator.unsubscribe();
        narrationQueue = null;
        cancelAutoLogin();
    }

    private void attemptAutoLogin(HomeView view) {
        ClientSession.AuthState auth = session.authenticated().orElse(null);
        if (auth == null) {
            return;
        }
        view.setStatus(Internationalization.text("home.restore.inprogress"));
        CompletableFuture<Void> future = new CompletableFuture<>();
        autoLoginTask = future;
        taskScheduler.runAsync(() -> {
            try {
                restClient.get("me", buildAuthHeaders(auth));
                future.complete(null);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                future.completeExceptionally(e);
            } catch (Exception e) {
                future.completeExceptionally(e);
            }
        });
        future.whenComplete((ignored, error) -> {
            if (autoLoginTask != future) {
                return;
            }
            autoLoginTask = null;
            if (error == null) {
                eventBus.publish(new LoginSucceeded(auth.username(), auth.token()));
                SwingUtilities.invokeLater(() -> view.setStatus(Internationalization.text("home.restore.success")));
            } else {
                session.clear();
                SwingUtilities.invokeLater(() -> {
                    view.setStatus(Internationalization.text("home.restore.failed"));
                    view.showLanding();
                });
            }
        });
    }

    private void cancelAutoLogin() {
        CompletableFuture<Void> future = autoLoginTask;
        autoLoginTask = null;
        if (future != null) {
            future.cancel(true);
        }
    }

    private Map<String, String> buildAuthHeaders(ClientSession.AuthState auth) {
        return Map.of("Authorization", "Bearer " + auth.token());
    }
}
