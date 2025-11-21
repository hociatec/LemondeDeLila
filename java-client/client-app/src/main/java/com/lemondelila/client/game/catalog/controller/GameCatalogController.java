package com.lemondelila.client.game.catalog.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.game.catalog.event.CatalogFailed;
import com.lemondelila.client.game.catalog.event.CatalogLoaded;
import com.lemondelila.client.game.catalog.event.CatalogRequested;
import com.lemondelila.client.game.catalog.model.CatalogPayload;
import com.lemondelila.client.game.catalog.service.GameCatalogService;

public final class GameCatalogController implements AutoCloseable {

    private final GameCatalogService service;
    private final DomainEventBus eventBus;
    private final TaskScheduler scheduler;
    private final EventSubscriptions subscriptions = new EventSubscriptions();

    @Inject
    public GameCatalogController(GameCatalogService service,
                                 DomainEventBus eventBus,
                                 TaskScheduler scheduler) {
        this.service = service;
        this.eventBus = eventBus;
        this.scheduler = scheduler;
        subscriptions.subscribe(eventBus, CatalogRequested.class, ev -> fetchAll());
    }

    public ControllerResult openCatalog() {
        fetchAll();
        return ControllerResult.navigate(com.lemondelila.client.game.catalog.view.GameCatalogScreen.ID)
                .withStatus("Catalogue en cours de chargement");
    }

    public void fetchAll() {
        scheduler.runAsync(() -> {
            try {
                CatalogPayload payload = service.fetchAll();
                eventBus.publish(new CatalogLoaded(payload));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (Exception e) {
                eventBus.publish(new CatalogFailed(clean(e.getMessage())));
            }
        });
    }

    @Override
    public void close() {
        subscriptions.close();
    }

    private static String clean(String message) {
        if (message == null) return "erreur";
        return message.replaceAll("\\s+", " ").trim();
    }
}
