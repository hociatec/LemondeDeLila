package com.lemondelila.framework.ui.screen;

import com.lemondelila.framework.core.context.ApplicationContext;
import com.lemondelila.framework.core.event.DomainEventBus;
import com.lemondelila.framework.core.task.TaskScheduler;

import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import java.awt.CardLayout;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

public final class ScreenManager {

    private final ApplicationContext applicationContext;
    private final DomainEventBus eventBus;
    private final TaskScheduler scheduler;
    private final JPanel container;
    private final Map<String, Screen> screens = new LinkedHashMap<>();
    private Screen current;

    public ScreenManager(ApplicationContext applicationContext,
                         DomainEventBus eventBus,
                         TaskScheduler scheduler) {
        this.applicationContext = applicationContext;
        this.eventBus = eventBus;
        this.scheduler = scheduler;
        this.container = new JPanel(new CardLayout());
    }

    public void register(Screen screen) {
        Objects.requireNonNull(screen, "screen");
        screens.put(screen.id(), screen);
        container.add(screen.getComponent(), screen.id());
    }

    public void show(String id) {
        Objects.requireNonNull(id, "id");
        Runnable switcher = () -> {
            Screen next = screens.get(id);
            if (next == null) {
                throw new IllegalArgumentException("Écran introuvable: " + id);
            }
            ScreenContext ctx = new ScreenContext(applicationContext, eventBus, this);
            if (current != null) {
                current.onHide(ctx);
            }
            CardLayout layout = (CardLayout) container.getLayout();
            layout.show(container, id);
            container.revalidate();
            container.repaint();
            java.awt.Window window = javax.swing.SwingUtilities.getWindowAncestor(container);
            if (window != null) {
                window.revalidate();
                window.repaint();
            }
            current = next;
            next.onShow(ctx);
        };
        if (SwingUtilities.isEventDispatchThread()) {
            switcher.run();
        } else {
            SwingUtilities.invokeLater(switcher);
        }
    }

    public JPanel getContainer() {
        return container;
    }

    public Optional<Screen> current() {
        return Optional.ofNullable(current);
    }
}
