package com.lemondelila.client.framework.network.rest;

import java.net.http.HttpResponse;

/**
 * Gestionnaire appelé lorsque le serveur répond 401/403.
 */
public interface UnauthorizedHandler {

    UnauthorizedHandler NONE = response -> {
    };

    void onUnauthorized(HttpResponse<String> response);
}
