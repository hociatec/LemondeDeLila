package com.lemondelila.client.framework.media.module;

import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.framework.media.audio.AudioService;

public final class MediaModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(AudioService.class);
    }

    @Override
    public void stop(ApplicationContext context) throws Exception {
        context.find(AudioService.class).ifPresent(audio -> {
            try {
                audio.close();
            } catch (Exception ignored) {
            }
        });
    }
}
