package com.lemondelila.client.framework.network.channel;

import java.net.URI;
import java.util.Map;

/**
 * Génère l'endpoint WebSocket final en fonction du token courant et d'un identifiant facultatif
 * (room, table, etc.).
 */
public interface RealtimeChannel {

    URI resolve(String token, Integer contextId);

    default URI resolve(String token, Integer contextId, Map<String, String> additionalParams) {
        return resolve(token, contextId);
    }
}
