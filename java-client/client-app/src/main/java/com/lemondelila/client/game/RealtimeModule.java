package com.lemondelila.client.game;

import com.google.auto.service.AutoService;
import com.lemondelila.client.user.events.LoginSucceeded;
import com.lemondelila.client.user.events.UserLoggedOut;
import com.lemondelila.client.user.model.ClientSession;
import com.lemondelila.client.game.service.TokenAwareRealtimeGateway;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.framework.network.ws.RealtimeGateway;

import java.net.http.WebSocket;

@AutoService(LilaModule.class)
public final class RealtimeModule implements LilaModule {

    private final EventSubscriptions subscriptions = new EventSubscriptions();

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bind(RealtimeGateway.class, TokenAwareRealtimeGateway.class);
    }

    @Override
    public void start(ApplicationContext context) {
        DomainEventBus eventBus = context.get(DomainEventBus.class);
        ClientSession session = context.get(ClientSession.class);
        RealtimeGateway gateway = context.get(RealtimeGateway.class);

        subscriptions.subscribe(eventBus, LoginSucceeded.class, event -> gateway.connect());
        subscriptions.subscribe(eventBus, UserLoggedOut.class,
                event -> gateway.disconnect(WebSocket.NORMAL_CLOSURE, "user-logout"));
        session.authenticated().ifPresent(ignored -> gateway.connect());
    }

    @Override
    public void stop(ApplicationContext context) {
        subscriptions.close();
        context.find(RealtimeGateway.class).ifPresent(gateway -> {
            try {
                gateway.close();
            } catch (Exception ignored) {
            }
        });
    }

    @Override
    public int order() {
        return 90;
    }

}
