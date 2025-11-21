package com.lemondelila.client.game.bot.view;

import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.game.bot.event.BotAdded;
import com.lemondelila.client.game.bot.event.BotOperationFailed;
import com.lemondelila.client.game.bot.event.BotRemoved;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class BotPresenter implements AutoCloseable {

    private static final Logger LOGGER = LoggerFactory.getLogger(BotPresenter.class);
    private final EventSubscriptions subscriptions = new EventSubscriptions();

    public BotPresenter(DomainEventBus eventBus) {
        subscriptions.subscribe(eventBus, BotAdded.class, e ->
                LOGGER.info("Bot ajouté dans room {} : {} ({})", e.roomId(), e.bot().name(), e.bot().id()));
        subscriptions.subscribe(eventBus, BotRemoved.class, e ->
                LOGGER.info("Bot supprimé dans room {} : {}", e.roomId(), e.botId()));
        subscriptions.subscribe(eventBus, BotOperationFailed.class, e ->
                LOGGER.warn("Action bot échouée : {}", e.message()));
    }

    @Override
    public void close() {
        subscriptions.close();
    }
}
