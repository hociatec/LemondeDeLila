package com.lemondelila.client.network;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.config.ConfigurationService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.framework.network.config.NetworkEndpoints;
import com.lemondelila.client.framework.network.rest.DefaultRetryStrategy;
import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.framework.network.rest.RestHeadersProvider;
import com.lemondelila.client.framework.network.rest.RetryStrategy;
import com.lemondelila.client.framework.network.rest.UnauthorizedHandler;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.game.service.RealtimeSignatureService;
import com.lemondelila.client.user.model.ClientSession;

import java.net.http.HttpClient;
import java.time.Duration;

@AutoService(LilaModule.class)
public final class ClientNetworkModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindFactory(CsrfTokenProvider.class, ctx -> new CsrfTokenProvider(ctx.get(ConfigurationService.class)));
        builder.bindFactory(RestHeadersProvider.class, ctx -> new SessionAuthHeadersProvider(
                ctx.get(ClientSession.class),
                ctx.get(CsrfTokenProvider.class)
        ));
        builder.bindAuto(RealtimeSignatureService.class);
        builder.bindFactory(UnauthorizedHandler.class, ctx -> new ClientUnauthorizedHandler(
                ctx.get(ClientSession.class),
                ctx.get(DialogService.class),
                ctx.get(DomainEventBus.class)
        ));
        builder.bindInstance(RetryStrategy.class, new DefaultRetryStrategy(4, Duration.ofMillis(300)));
        builder.bindFactory(RestClient.class, ctx -> new RestClient(
                ctx.get(HttpClient.class),
                ctx.get(ObjectMapper.class),
                ctx.get(NetworkEndpoints.class).httpBase(),
                ctx.get(RestHeadersProvider.class),
                ctx.get(RetryStrategy.class),
                ctx.get(UnauthorizedHandler.class)
        ));
    }

    @Override
    public int order() {
        return 30;
    }
}
