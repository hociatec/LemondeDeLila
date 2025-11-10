package com.lemondelila.client.service.game;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.model.user.ClientSession;
import com.lemondelila.framework.core.task.TaskScheduler;
import com.lemondelila.framework.network.rest.RestClient;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.function.Supplier;

/**
 * Utilitaires communs pour les services distants de jeux (création de salle, requêtes REST, auth).
 */
public abstract class RemoteGameServiceSupport {

    protected final RestClient restClient;
    protected final TaskScheduler scheduler;
    protected final ClientSession session;

    protected RemoteGameServiceSupport(RestClient restClient,
                                       TaskScheduler scheduler,
                                       ClientSession session) {
        this.restClient = Objects.requireNonNull(restClient, "restClient");
        this.scheduler = Objects.requireNonNull(scheduler, "scheduler");
        this.session = Objects.requireNonNull(session, "session");
    }

    protected Map<String, String> authHeaders() {
        ClientSession.AuthState auth = session.authenticated()
                .orElseThrow(() -> new IllegalStateException("Utilisateur non authentifie"));
        return Map.of("Authorization", "Bearer " + auth.token());
    }

    protected CompletableFuture<JsonNode> asyncGet(String path, Map<String, String> headers) {
        return supplyAsync(() -> restClient.get(path, headers));
    }

    protected CompletableFuture<JsonNode> asyncPost(String path,
                                                    Map<String, String> headers,
                                                    Map<String, Object> payload) {
        return supplyAsync(() -> restClient.post(path, headers, payload));
    }

    protected <T> CompletableFuture<T> supplyAsync(ThrowingSupplier<T> supplier) {
        CompletableFuture<T> future = new CompletableFuture<>();
        scheduler.runAsync(() -> {
            try {
                future.complete(supplier.get());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                future.completeExceptionally(e);
            } catch (Exception e) {
                future.completeExceptionally(e);
            }
        });
        return future;
    }

    protected int createRoom(String gameType,
                             String defaultName,
                             int maxPlayers,
                             Map<String, String> headers) throws IOException, InterruptedException {
        Map<String, Object> payload = new HashMap<>();
        payload.put("gameType", gameType);
        payload.put("name", defaultName);
        payload.put("maxPlayers", maxPlayers);
        JsonNode response = restClient.post("rooms/", headers, payload);
        int roomId = response.path("id").asInt(-1);
        if (roomId <= 0) {
            throw new IOException("Identifiant de salle invalide pour " + gameType);
        }
        return roomId;
    }

    @FunctionalInterface
    protected interface ThrowingSupplier<T> {
        T get() throws Exception;
    }

    protected static RuntimeException propagate(Throwable error) {
        if (error instanceof RuntimeException runtime) {
            return runtime;
        }
        return new CompletionException(error);
    }
}
