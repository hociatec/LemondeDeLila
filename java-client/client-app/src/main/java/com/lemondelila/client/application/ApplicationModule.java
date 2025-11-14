package com.lemondelila.client.application;

import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.catalogue.CatalogueModule;
import com.lemondelila.client.chat.ChatModule;
import com.lemondelila.client.application.AppBranding;
import com.lemondelila.client.media.AudioModule;
import com.lemondelila.client.game.GameModule;
import com.lemondelila.client.game.RealtimeModule;
import com.lemondelila.client.presence.PresenceModule;
import com.lemondelila.client.social.SocialModule;
import com.lemondelila.client.messaging.MessagingModule;
import com.lemondelila.client.settings.SettingsModule;
import com.lemondelila.client.user.UserModule;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class ApplicationModule implements LilaModule {

    private final List<LilaModule> modules;
    private final List<LilaModule> startOrder;
    private final List<LilaModule> stopOrder;

    public ApplicationModule() {
        this.modules = List.of(
                new SettingsModule(),
                new UserModule(),
                new ChatModule(),
                new MessagingModule(),
                new SocialModule(),
                new PresenceModule(),
                new CatalogueModule(),
                new GameModule(),
                new AudioModule(),
                new ScreenModule(),
                new RealtimeModule()
        );
        this.startOrder = modules.stream()
                .sorted(Comparator.comparingInt(LilaModule::order))
                .toList();
        List<LilaModule> descending = new ArrayList<>(startOrder);
        descending.sort(Comparator.comparingInt(LilaModule::order).reversed());
        this.stopOrder = List.copyOf(descending);
    }

    @Override
    public void configure(ApplicationContext.Builder builder) {
        startOrder.forEach(module -> module.configure(builder));
        builder.bindAuto(AppBranding.class);
    }

    @Override
    public void start(ApplicationContext context) throws Exception {
        for (LilaModule module : startOrder) {
            module.start(context);
        }
    }

    @Override
    public void stop(ApplicationContext context) throws Exception {
        Exception firstError = null;
        for (LilaModule module : stopOrder) {
            try {
                module.stop(context);
            } catch (Exception ex) {
                if (firstError == null) {
                    firstError = ex;
                }
            }
        }
        if (firstError != null) {
            throw firstError;
        }
    }

    @Override
    public int order() {
        return 100;
    }
}

