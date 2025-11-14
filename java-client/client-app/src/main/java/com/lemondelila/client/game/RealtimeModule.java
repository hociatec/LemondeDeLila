package com.lemondelila.client.game;

import com.lemondelila.client.user.events.LoginSucceeded;
import com.lemondelila.client.user.events.UserLoggedOut;
import com.lemondelila.client.user.model.ClientSession;
import com.lemondelila.client.game.service.TokenAwareRealtimeGateway;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.framework.network.ws.RealtimeGateway;

import java.net.http.WebSocket;

public final class RealtimeModule implements LilaModule {

    private AutoCloseable loginSubscription;
    private AutoCloseable logoutSubscription;

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bind(RealtimeGateway.class, TokenAwareRealtimeGateway.class);
    }

    @Override
    public void start(ApplicationContext context) {
        DomainEventBus eventBus = context.get(DomainEventBus.class);
        ClientSession session = context.get(ClientSession.class);
        RealtimeGateway gateway = context.get(RealtimeGateway.class);

        loginSubscription = eventBus.subscribe(LoginSucceeded.class, event -> gateway.connect());
        logoutSubscription = eventBus.subscribe(UserLoggedOut.class,
                event -> gateway.disconnect(WebSocket.NORMAL_CLOSURE, "user-logout"));
        session.authenticated().ifPresent(ignored -> gateway.connect());
    }

    @Override
    public void stop(ApplicationContext context) {
        closeQuietly(loginSubscription);
        loginSubscription = null;
        closeQuietly(logoutSubscription);
        logoutSubscription = null;
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

    private static void closeQuietly(AutoCloseable closable) {
        if (closable == null) {
            return;
        }
        try {
            closable.close();
        } catch (Exception ignored) {
        }
    }
}
