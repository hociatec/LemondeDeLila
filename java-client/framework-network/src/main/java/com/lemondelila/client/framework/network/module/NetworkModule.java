package com.lemondelila.client.framework.network.module;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.framework.network.ws.RealtimeGateway;

import java.net.http.HttpClient;
import java.time.Duration;

public final class NetworkModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bind(HttpClient.class, () -> HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build());
        builder.bindAuto(ObjectMapper.class);
        builder.bindAuto(RestClient.class);
        builder.bindAuto(RealtimeGateway.class);
    }

    @Override
    public int order() {
        return 0;
    }
}
