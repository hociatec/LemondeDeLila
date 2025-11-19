package com.lemondelila.client.framework.network.rest;

import java.util.Collections;
import java.util.Map;
import java.util.Objects;

/**
 * Fournit des entêtes HTTP communes pour toutes les requêtes REST.
 */
public interface RestHeadersProvider {

    Map<String, String> headers();

    RestHeadersProvider NONE = Collections::emptyMap;

    static RestHeadersProvider empty() {
        return NONE;
    }

    static RestHeadersProvider of(Map<String, String> headers) {
        Objects.requireNonNull(headers, "headers");
        return () -> headers;
    }
}
