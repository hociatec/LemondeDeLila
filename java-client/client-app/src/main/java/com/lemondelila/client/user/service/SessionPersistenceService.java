package com.lemondelila.client.user.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.lemondelila.client.user.events.LoginSucceeded;
import com.lemondelila.client.user.events.UserLoggedOut;
import com.lemondelila.client.user.model.ClientSession;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.security.EncryptedSessionVault;
import com.lemondelila.client.security.SessionVault;
import com.lemondelila.client.settings.model.AppSettings;
import com.lemondelila.client.settings.service.AppSettingsService;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;
import java.util.Optional;
import java.time.Instant;

public final class SessionPersistenceService implements AutoCloseable {

    private static final Path LEGACY_SESSION_FILE = Path.of("config", "session.json");

    private final DomainEventBus eventBus;
    private final ClientSession session;
    private final AppSettingsService settingsService;
    private final ObjectMapper mapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
    private final SessionVault sessionVault;

    private final AutoCloseable loginSubscription;
    private final AutoCloseable logoutSubscription;
    private final AutoCloseable settingsSubscription;

    @Inject
    public SessionPersistenceService(DomainEventBus eventBus,
                                      ClientSession session,
                                      AppSettingsService settingsService,
                                      SessionVault sessionVault) {
        this.eventBus = Objects.requireNonNull(eventBus, "eventBus");
        this.session = Objects.requireNonNull(session, "session");
        this.settingsService = Objects.requireNonNull(settingsService, "settingsService");
        this.sessionVault = Objects.requireNonNullElseGet(sessionVault, EncryptedSessionVault::defaultVault);

        restoreIfNeeded();

        this.loginSubscription = eventBus.subscribe(LoginSucceeded.class, this::handleLoginSucceeded);
        this.logoutSubscription = eventBus.subscribe(UserLoggedOut.class, event -> handleLogout());
        this.settingsSubscription = settingsService.listen(this::handleSettingsUpdate);
    }

    private void restoreIfNeeded() {
        AppSettings current = settingsService.current();
        if (!current.stayConnected()) {
            clearPersistedSession();
            return;
        }
        sessionVault.load()
                .or(() -> migrateLegacyIfPresent())
                .ifPresent(record -> {
                    session.setAuthenticated(record.username(), record.token());
                });
    }

    private void handleLoginSucceeded(LoginSucceeded event) {
        if (!settingsService.current().stayConnected()) {
            clearPersistedSession();
            return;
        }
        storeSession(event.username(), event.token());
    }

    private void handleLogout() {
        clearPersistedSession();
    }

    private void handleSettingsUpdate(AppSettings settings) {
        if (!settings.stayConnected()) {
            clearPersistedSession();
            return;
        }
        Optional<ClientSession.AuthState> auth = session.authenticated();
        auth.ifPresent(state -> storeSession(state.username(), state.token()));
    }

    private void storeSession(String username, String token) {
        sessionVault.save(new SessionVault.SessionRecord(username, token, Instant.now()));
    }

    private void clearPersistedSession() {
        sessionVault.clear();
        deleteLegacyFile();
    }

    @Override
    public void close() throws Exception {
        if (loginSubscription != null) {
            loginSubscription.close();
        }
        if (logoutSubscription != null) {
            logoutSubscription.close();
        }
        if (settingsSubscription != null) {
            settingsSubscription.close();
        }
    }

    private Optional<SessionVault.SessionRecord> migrateLegacyIfPresent() {
        if (!Files.exists(LEGACY_SESSION_FILE)) {
            return Optional.empty();
        }
        try {
            JsonNode node = mapper.readTree(LEGACY_SESSION_FILE.toFile());
            String username = node.path("username").asText(null);
            String token = node.path("token").asText(null);
            if (username == null || token == null || username.isBlank() || token.isBlank()) {
                deleteLegacyFile();
                return Optional.empty();
            }
            SessionVault.SessionRecord record = new SessionVault.SessionRecord(username, token, Instant.now());
            sessionVault.save(record);
            deleteLegacyFile();
            return Optional.of(record);
        } catch (IOException e) {
            deleteLegacyFile();
            return Optional.empty();
        }
    }

    private void deleteLegacyFile() {
        try {
            Files.deleteIfExists(LEGACY_SESSION_FILE);
        } catch (IOException ex) {
            LOGGER.debug("[session] impossible de supprimer l'ancien fichier de session: {}", ex.getMessage());
        }
    }
}
