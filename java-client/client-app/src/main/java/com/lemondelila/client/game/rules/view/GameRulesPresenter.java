package com.lemondelila.client.game.rules.view;

import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.game.rules.event.GameRulesFailed;
import com.lemondelila.client.game.rules.event.GameRulesLoaded;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class GameRulesPresenter implements AutoCloseable {

    private static final Logger LOGGER = LoggerFactory.getLogger(GameRulesPresenter.class);
    private final EventSubscriptions subscriptions = new EventSubscriptions();

    public GameRulesPresenter(DomainEventBus eventBus) {
        subscriptions.subscribe(eventBus, GameRulesLoaded.class, e ->
                LOGGER.info("Règles chargées pour {} ({} chars)", e.document().gameId(), e.document().content().length()));
        subscriptions.subscribe(eventBus, GameRulesFailed.class, e ->
                LOGGER.warn("Echec chargement règles {} : {}", e.gameId(), e.reason()));
    }

    @Override
    public void close() {
        subscriptions.close();
    }
}
