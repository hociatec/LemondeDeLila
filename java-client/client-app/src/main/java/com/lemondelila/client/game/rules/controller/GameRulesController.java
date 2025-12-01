package com.lemondelila.client.game.rules.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.game.rules.event.GameRulesFailed;
import com.lemondelila.client.game.rules.event.GameRulesLoaded;
import com.lemondelila.client.game.rules.event.GameRulesRequested;
import com.lemondelila.client.game.rules.model.GameRuleDocument;
import com.lemondelila.client.game.rules.service.GameRulesService;

public final class GameRulesController implements AutoCloseable {

    private final GameRulesService service;
    private final DomainEventBus eventBus;
    private final TaskScheduler scheduler;
    private final EventSubscriptions subscriptions = new EventSubscriptions();

    @Inject
    public GameRulesController(GameRulesService service,
                               DomainEventBus eventBus,
                               TaskScheduler scheduler) {
        this.service = service;
        this.eventBus = eventBus;
        this.scheduler = scheduler;
        subscriptions.subscribe(eventBus, GameRulesRequested.class, this::onRulesRequested);
    }

    private void onRulesRequested(GameRulesRequested request) {
        scheduler.runAsync(() -> {
            try {
                GameRuleDocument doc = service.load(request.gameId());
                eventBus.publish(new GameRulesLoaded(doc));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (Exception e) {
                eventBus.publish(new GameRulesFailed(request.gameId(), clean(e.getMessage())));
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
