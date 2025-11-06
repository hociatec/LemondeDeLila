package com.lemondelila.framework.media.module;

import com.lemondelila.framework.core.context.ApplicationContext;
import com.lemondelila.framework.core.module.LilaModule;
import com.lemondelila.framework.media.audio.AudioService;

public final class MediaModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bind(AudioService.class, AudioService::new);
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

