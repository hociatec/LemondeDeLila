package com.lemondelila.client.game.catalog.view;

import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.game.catalog.event.CatalogFailed;
import com.lemondelila.client.game.catalog.event.CatalogLoaded;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class GameCatalogPresenter implements AutoCloseable {

    private static final Logger LOGGER = LoggerFactory.getLogger(GameCatalogPresenter.class);
    private final EventSubscriptions subscriptions = new EventSubscriptions();

    public GameCatalogPresenter(DomainEventBus eventBus) {
        subscriptions.subscribe(eventBus, CatalogLoaded.class, e ->
                LOGGER.info("Catalogue chargé : {} jeux, {} catégories", e.payload().games().size(), e.payload().categories().size()));
        subscriptions.subscribe(eventBus, CatalogFailed.class, e ->
                LOGGER.warn("Echec chargement catalogue : {}", e.reason()));
    }

    @Override
    public void close() {
        subscriptions.close();
    }
}
