package com.lemondelila.client.chat.presenter;

import com.lemondelila.client.chat.model.ChatConnection;
import com.lemondelila.client.chat.model.ChatMessage;
import com.lemondelila.client.chat.model.ChatState;
import com.lemondelila.client.chat.service.ChatConnectionFactory;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.presence.event.PresenceEvent;
import com.lemondelila.client.presence.event.PresenceEventListener;
import com.lemondelila.client.presence.event.PresenceUpdateEvent;
import com.lemondelila.client.presence.model.PresencePlayer;
import com.lemondelila.client.presence.service.PresenceRealtimeService;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

public final class ChatPresenter implements AutoCloseable {

    private final ChatConnectionFactory connectionFactory;
    private final PresenceRealtimeService presenceService;

    private final PresenceEventListener presenceListener = this::handlePresenceEvent;
    private final AtomicBoolean started = new AtomicBoolean();

    private volatile ChatConnection connection;
    private volatile ChatView view;
    private volatile boolean presenceAttached;

    @Inject
    public ChatPresenter(ChatConnectionFactory connectionFactory,
                         PresenceRealtimeService presenceService) {
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
        this.presenceService = Objects.requireNonNull(presenceService, "presenceService");
    }

    public void attach(ChatView view) {
        this.view = Objects.requireNonNull(view, "view");
    }

    public void detach() {
        this.view = null;
    }

    public void start() {
        if (!started.compareAndSet(false, true)) {
            return;
        }
        ChatConnection chatConnection = connectionFactory.open();
        this.connection = chatConnection;
        chatConnection.onHistory(messages -> withView(v -> v.showHistory(messages)));
        chatConnection.onMessage(message -> withView(v -> v.appendMessage(message)));
        chatConnection.onState(state -> withView(v -> v.showStatus(state)));
        chatConnection.onError(error -> withView(v -> v.showError(error)));
        chatConnection.connect();
        attachPresence();
    }

    public void sendMessage(String text) {
        ChatConnection chatConnection = this.connection;
        if (chatConnection == null) {
            return;
        }
        chatConnection.sendMessage(text);
    }

    @Override
    public void close() {
        ChatConnection chatConnection = this.connection;
        this.connection = null;
        if (chatConnection != null) {
            chatConnection.close();
        }
        detachPresence();
        started.set(false);
    }

    private void attachPresence() {
        if (presenceAttached) {
            return;
        }
        presenceService.addListener(presenceListener);
        presenceService.start();
        presenceAttached = true;
        List<PresencePlayer> snapshot = presenceService.latestPresence();
        if (!snapshot.isEmpty()) {
            withView(v -> v.updatePresence(snapshot));
        } else {
            withView(v -> v.updatePresence(List.of()));
        }
    }

    private void detachPresence() {
        if (!presenceAttached) {
            return;
        }
        presenceService.removeListener(presenceListener);
        presenceService.stop();
        presenceAttached = false;
    }

    private void handlePresenceEvent(PresenceEvent event) {
        if (event instanceof PresenceUpdateEvent update) {
            withView(v -> v.updatePresence(update.players()));
        }
    }

    private void withView(Consumer<ChatView> consumer) {
        ChatView current = this.view;
        if (current != null) {
            consumer.accept(current);
        }
    }
}

