package com.lemondelila.client.home;

import com.google.auto.service.AutoService;
import com.lemondelila.client.application.AppBranding;
import com.lemondelila.client.home.controller.HomeEventCoordinator;
import com.lemondelila.client.home.controller.HomePresenter;
import com.lemondelila.client.home.controller.HomeScreenLifecycle;
import com.lemondelila.client.home.controller.HomeUiBindings;
import com.lemondelila.client.home.view.HomeView;
import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.framework.access.NarrationQueue;
import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.framework.ui.action.ActionManager;
import com.lemondelila.client.framework.ui.component.StatusBannerFactory;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.lifecycle.ApplicationLifecycle;
import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.settings.service.AppSettingsService;
import com.lemondelila.client.user.model.ClientSession;
import com.lemondelila.client.user.service.RememberedCredentialsService;

import java.util.function.Supplier;

@AutoService(LilaModule.class)
public final class HomeModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindFactory(HomeView.class, ctx -> new HomeView(
                ctx.get(FocusHighlighter.class),
                ctx.get(AppBranding.class),
                ctx.get(StatusBannerFactory.class)
        ));
        builder.bindFactory(HomeEventCoordinator.class, ctx -> new HomeEventCoordinator(ctx.get(DomainEventBus.class)));
        builder.bindFactory(HomeUiBindings.class, ctx -> new HomeUiBindings(
                ctx.get(HomeView.class),
                ctx.get(DialogService.class),
                ctx.get(DomainEventBus.class),
                ctx.get(ActionManager.class),
                ctx.get(AccessibleShortcutRegistry.class),
                ctx.get(ApplicationLifecycle.class),
                ctx.get(RememberedCredentialsService.class)
        ));
        builder.bindFactory(HomeScreenLifecycle.class, ctx -> new HomeScreenLifecycle(
                ctx.get(HomeEventCoordinator.class),
                (Supplier<NarrationQueue>) () -> ctx.get(NarrationQueue.class),
                ctx.get(AppSettingsService.class),
                ctx.get(ClientSession.class),
                ctx.get(DomainEventBus.class),
                ctx.get(RestClient.class),
                ctx.get(TaskScheduler.class)
        ));
        builder.bindFactory(HomePresenter.class, ctx -> new HomePresenter(
                ctx.get(HomeView.class),
                ctx.get(DialogService.class),
                ctx.get(HomeUiBindings.class),
                ctx.get(HomeScreenLifecycle.class)
        ));
    }

    @Override
    public int order() {
        return 25;
    }
}
