package com.lemondelila.framework.network.module;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.framework.core.config.ConfigurationService;
import com.lemondelila.framework.core.context.ApplicationContext;
import com.lemondelila.framework.core.event.DomainEventBus;
import com.lemondelila.framework.core.module.LilaModule;
import com.lemondelila.framework.network.rest.RestClient;
import com.lemondelila.framework.network.ws.RealtimeGateway;
import com.lemondelila.framework.network.ws.StandardRealtimeGateway;

import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;

public final class NetworkModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bind(HttpClient.class, () -> HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build());
        builder.bind(ObjectMapper.class, ObjectMapper::new);
        builder.bindFactory(RestClient.class, ctx -> {
            ConfigurationService config = ctx.get(ConfigurationService.class);
            URI baseUri = URI.create(config.get("network.http.base", "https://hociatec.fr/api/"));
            return new RestClient(ctx.get(HttpClient.class), ctx.get(ObjectMapper.class), baseUri);
        });
        builder.bindFactory(RealtimeGateway.class, ctx -> {
            ConfigurationService config = ctx.get(ConfigurationService.class);
            return new StandardRealtimeGateway(
                    ctx.get(HttpClient.class),
                    () -> URI.create(config.get("network.ws.url", "wss://hociatec.fr/ws")),
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
