package com.lemondelila.framework.access.module;

import com.lemondelila.framework.access.FocusHighlighter;
import com.lemondelila.framework.access.NarrationQueue;
import com.lemondelila.framework.access.ScreenReaderAnnouncer;
import com.lemondelila.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.framework.core.context.ApplicationContext;
import com.lemondelila.framework.core.module.LilaModule;

public final class AccessibilityModule implements LilaModule {

    private NarrationQueue narrationQueue;
    private ScreenReaderAnnouncer announcer;

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bind(ScreenReaderAnnouncer.class, ScreenReaderAnnouncer::new);
        builder.bindFactory(NarrationQueue.class, ctx -> new NarrationQueue(ctx.get(ScreenReaderAnnouncer.class)));
        builder.bind(AccessibleShortcutRegistry.class, AccessibleShortcutRegistry::new);
        builder.bind(FocusHighlighter.class, FocusHighlighter::new);
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
