package com.lemondelila.client.network;

import com.lemondelila.client.framework.network.rest.RestHeadersProvider;
import com.lemondelila.client.user.model.ClientSession;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Ajoute automatiquement le header Authorization quand une session est authentifiée.
 */
public final class SessionAuthHeadersProvider implements RestHeadersProvider {

    private final ClientSession session;
    private final CsrfTokenProvider csrf;

    public SessionAuthHeadersProvider(ClientSession session, CsrfTokenProvider csrf) {
        this.session = session;
        this.csrf = csrf;
    }

    @Override
    public Map<String, String> headers() {
        Optional<ClientSession.AuthState> auth = session.authenticated();
        if (auth.isEmpty()) {
            return Collections.emptyMap();
        }
        String token = auth.get().token();
        if (token == null || token.isBlank()) {
            return Collections.emptyMap();
        }
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Authorization", "Bearer " + token);
        if (csrf != null && csrf.isPresent()) {
            headers.put("X-CSRF-Token", csrf.current());
        }
        return headers;
    }
}
