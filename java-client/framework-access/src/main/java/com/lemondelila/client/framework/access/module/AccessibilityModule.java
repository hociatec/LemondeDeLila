package com.lemondelila.client.framework.access.module;

import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.framework.access.NarrationQueue;
import com.lemondelila.client.framework.access.ScreenReaderAnnouncer;
import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.access.game.AccessibilityService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;

public final class AccessibilityModule implements LilaModule {

    private NarrationQueue narrationQueue;
    private ScreenReaderAnnouncer announcer;

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(ScreenReaderAnnouncer.class);
        builder.bindAuto(NarrationQueue.class);
        builder.bindAuto(AccessibleShortcutRegistry.class);
        builder.bindAuto(FocusHighlighter.class);
        builder.bindAuto(AccessibilityService.class);
    }

    @Override
    public void start(ApplicationContext context) {
        announcer = context.get(ScreenReaderAnnouncer.class);
        narrationQueue = context.get(NarrationQueue.class);
    }

    @Override
    public void stop(ApplicationContext context) throws Exception {
        if (narrationQueue != null) {
            narrationQueue.close();
            narrationQueue = null;
        }
        if (announcer != null) {
            announcer.close();
            announcer = null;
        }
    }

    @Override
    public int order() {
        return -10;
    }
}
