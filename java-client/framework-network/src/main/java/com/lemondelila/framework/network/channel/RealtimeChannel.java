package com.lemondelila.framework.network.channel;

import java.net.URI;

/**
 * Génère l'endpoint WebSocket final en fonction du token courant et d'un identifiant facultatif
 * (room, table, etc.).
 */
public interface RealtimeChannel {

    URI resolve(String token, Integer contextId);
}
