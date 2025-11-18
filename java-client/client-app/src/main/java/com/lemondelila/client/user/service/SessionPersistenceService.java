package com.lemondelila.client.user.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.lemondelila.client.settings.model.AppSettings;
import com.lemondelila.client.settings.service.AppSettingsService;
import com.lemondelila.client.settings.storage.UserStoragePaths;
import com.lemondelila.client.user.events.LoginSucceeded;
import com.lemondelila.client.user.events.UserLoggedOut;
import com.lemondelila.client.user.model.ClientSession;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;
import java.util.Optional;

public final class SessionPersistenceService implements AutoCloseable {

    private final DomainEventBus eventBus;
    private final ClientSession session;
    private final AppSettingsService settingsService;
    private final ObjectMapper mapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
    private final Path sessionFile;

    private final EventSubscriptions subscriptions = new EventSubscriptions();

    @Inject
    public SessionPersistenceService(DomainEventBus eventBus,
                                     ClientSession session,
                                     AppSettingsService settingsService,
                                     UserStoragePaths storagePaths) {
        this.eventBus = Objects.requireNonNull(eventBus, "eventBus");
        this.session = Objects.requireNonNull(session, "session");
        this.settingsService = Objects.requireNonNull(settingsService, "settingsService");
        this.sessionFile = storagePaths.sessionFile();

        restoreIfNeeded();

        subscriptions.subscribe(eventBus, LoginSucceeded.class, this::handleLoginSucceeded);
        subscriptions.subscribe(eventBus, UserLoggedOut.class, event -> handleLogout());
        subscriptions.add(settingsService.listen(this::handleSettingsUpdate));
    }

    private void restoreIfNeeded() {
        AppSettings current = settingsService.current();
        if (!current.stayConnected()) {
            deleteStoredSession();
            return;
        }
        if (!Files.exists(sessionFile)) {
            return;
        }
        try {
            JsonNode node = mapper.readTree(sessionFile.toFile());
            String username = node.path("username").asText(null);
            String token = node.path("token").asText(null);
            if (username == null || token == null || username.isBlank() || token.isBlank()) {
                deleteStoredSession();
                return;
            }
            session.setAuthenticated(username, token);
        } catch (IOException e) {
            deleteStoredSession();
        }
    }

    private void handleLoginSucceeded(LoginSucceeded event) {
        if (!settingsService.current().stayConnected()) {
            deleteStoredSession();
            return;
        }
        storeSession(event.username(), event.token());
    }

    private void handleLogout() {
        deleteStoredSession();
    }

    private void handleSettingsUpdate(AppSettings settings) {
        if (!settings.stayConnected()) {
            deleteStoredSession();
            return;
        }
        Optional<ClientSession.AuthState> auth = session.authenticated();
        auth.ifPresent(state -> storeSession(state.username(), state.token()));
    }

    private void storeSession(String username, String token) {
        try {
            Files.createDirectories(sessionFile.getParent());
            mapper.writeValue(sessionFile.toFile(), java.util.Map.of(
                    "username", username,
                    "token", token
            ));
        } catch (IOException ignored) {
        }
    }

    private void deleteStoredSession() {
        try {
            Files.deleteIfExists(sessionFile);
        } catch (IOException ignored) {
        }
    }

    @Override
    public void close() throws Exception {
        subscriptions.close();
    }
}
