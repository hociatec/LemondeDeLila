package com.lemondelila.client.network;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.framework.network.config.NetworkEndpoints;
import com.lemondelila.client.user.model.ClientSession;

import java.net.http.HttpClient;

@AutoService(LilaModule.class)
public final class WebsocketApiModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindFactory(RealtimeApiClient.class, ctx -> new RealtimeApiClient(
                ctx.get(HttpClient.class),
                ctx.get(ObjectMapper.class),
                ctx.get(DomainEventBus.class),
                ctx.get(NetworkEndpoints.class),
                ctx.get(ClientSession.class)
        ));
    }

    @Override
    public int order() {
        return 35;
    }
}
