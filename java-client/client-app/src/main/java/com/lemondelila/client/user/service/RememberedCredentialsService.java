package com.lemondelila.client.user.service;

import com.lemondelila.client.security.CredentialsVault;
import com.lemondelila.client.framework.core.di.Inject;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

public final class RememberedCredentialsService {

    private final CredentialsVault vault;

    @Inject
    public RememberedCredentialsService(CredentialsVault vault) {
        this.vault = Objects.requireNonNull(vault, "vault");
    }

    public Optional<RememberedCredentials> load() {
        return vault.load().map(record ->
                new RememberedCredentials(record.username(), record.password().toCharArray()));
    }

    public void save(String username, char[] password) {
        if (username == null || username.isBlank() || password == null || password.length == 0) {
            clear();
            return;
        }
        vault.save(new CredentialsVault.CredentialRecord(username, String.valueOf(password), Instant.now()));
    }

    public void clear() {
        vault.clear();
    }

    public record RememberedCredentials(String username, char[] password) {
    }
}
