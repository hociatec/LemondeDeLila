
package com.lemondelila.client.application.view.home;

import com.lemondelila.client.application.AppBranding;
import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.framework.ui.action.ActionManager;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.lifecycle.ApplicationLifecycle;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.settings.service.AppSettingsService;
import com.lemondelila.client.user.model.ClientSession;

import javax.swing.JPanel;
import java.awt.BorderLayout;
import java.util.function.Supplier;

public final class HomeScreen extends JPanel implements Screen {

    public static final ScreenId ID = ScreenId.of("home");

    private final HomeView view;
    private final HomePresenter presenter;
    private ScreenManager screenManager;

    @Inject
    public HomeScreen(DomainEventBus eventBus,
                      ActionManager actionManager,
                      AccessibleShortcutRegistry shortcutRegistry,
                      FocusHighlighter focusHighlighter,
                      DialogService dialogService,
                      ApplicationContext context,
                      AppBranding branding) {
        this(eventBus, actionManager, shortcutRegistry, focusHighlighter, dialogService,
                () -> context.get(com.lemondelila.client.framework.access.NarrationQueue.class),
                branding,
                context.get(ClientSession.class),
                context.get(AppSettingsService.class),
                context.get(ApplicationLifecycle.class),
                context.get(RestClient.class),
                context.get(TaskScheduler.class));
    }

    HomeScreen(DomainEventBus eventBus,
               ActionManager actionManager,
               AccessibleShortcutRegistry shortcutRegistry,
               FocusHighlighter focusHighlighter,
               DialogService dialogService,
               Supplier<com.lemondelila.client.framework.access.NarrationQueue> narrationQueueSupplier,
               AppBranding branding,
               ClientSession session,
               AppSettingsService settingsService,
               ApplicationLifecycle applicationLifecycle,
               RestClient restClient,
               TaskScheduler taskScheduler) {
        this.view = new HomeView(focusHighlighter, branding, narrationQueueSupplier.get());
        HomeEventCoordinator eventCoordinator = new HomeEventCoordinator(eventBus);
        HomeUiBindings uiBindings = new HomeUiBindings(view, dialogService, eventBus, actionManager, shortcutRegistry, applicationLifecycle);
        HomeScreenLifecycle lifecycle = new HomeScreenLifecycle(
                eventCoordinator,
                narrationQueueSupplier,
                settingsService,
                session,
                eventBus,
                restClient,
                taskScheduler);
        this.presenter = new HomePresenter(view, dialogService, uiBindings, lifecycle);
        setLayout(new BorderLayout());
        add(view.component(), BorderLayout.CENTER);
    }

    @Override
    public ScreenId id() {
        return ID;
    }

    @Override
    public JPanel getComponent() {
        return this;
    }

    @Override
    public void onShow(ScreenContext context) {
        this.screenManager = context.screenManager();
        presenter.onShow(screenManager, this);
    }

    @Override
    public void onHide(ScreenContext context) {
        this.screenManager = null;
        presenter.onHide();
    }
}
