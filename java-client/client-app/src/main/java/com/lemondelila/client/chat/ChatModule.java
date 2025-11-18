package com.lemondelila.client.chat;

import com.lemondelila.client.chat.controller.ChatController;
import com.lemondelila.client.chat.presenter.ChatPresenter;
import com.lemondelila.client.user.events.UserLoggedOut;
import com.lemondelila.client.chat.service.ChatConnectionFactory;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.framework.core.module.LilaModule;

public final class ChatModule implements LilaModule {

    private final EventSubscriptions subscriptions = new EventSubscriptions();

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(ChatConnectionFactory.class);
        builder.bindAuto(ChatPresenter.class);
        builder.bindAuto(ChatController.class);
    }

    @Override
    public void start(ApplicationContext context) {
        ChatController controller = context.get(ChatController.class);
        DomainEventBus eventBus = context.get(DomainEventBus.class);
        subscriptions.subscribe(eventBus, UserLoggedOut.class, event -> controller.close());
    }

    @Override
    public void stop(ApplicationContext context) {
        subscriptions.close();
        context.find(ChatController.class).ifPresent(controller -> {
            try {
                controller.close();
            } catch (Exception ignored) {
            }
        });
    }

    @Override
    public int order() {
        return 30;
    }
}
