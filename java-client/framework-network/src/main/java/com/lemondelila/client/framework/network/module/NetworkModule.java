package com.lemondelila.client.framework.network.module;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.config.ConfigurationService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.framework.network.config.NetworkEndpoints;
import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.framework.network.ws.RealtimeGateway;
import com.lemondelila.client.framework.network.ws.StandardRealtimeGateway;

import java.net.http.HttpClient;
import java.time.Duration;

@AutoService(LilaModule.class)
public final class NetworkModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bind(HttpClient.class, () -> HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build());
        builder.bind(ObjectMapper.class, ObjectMapper::new);
        builder.bindFactory(NetworkEndpoints.class, ctx -> new NetworkEndpoints(ctx.get(ConfigurationService.class)));
        builder.bindFactory(RestClient.class, ctx -> new RestClient(
                ctx.get(HttpClient.class),
                ctx.get(ObjectMapper.class),
                ctx.get(NetworkEndpoints.class).httpBase()
        ));
        builder.bindFactory(RealtimeGateway.class, ctx -> {
            return new StandardRealtimeGateway(
                    ctx.get(HttpClient.class),
                    () -> ctx.get(NetworkEndpoints.class).realtimeGateway(),
                    ctx.get(ObjectMapper.class),
                    ctx.get(DomainEventBus.class)
            );
        });
    }

    @Override
    public int order() {
        return 0;
    }
}
