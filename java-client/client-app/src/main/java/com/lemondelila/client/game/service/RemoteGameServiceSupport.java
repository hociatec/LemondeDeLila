package com.lemondelila.client.game.service;

import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.game.service.dto.RoomResponseDto;
import com.lemondelila.client.user.model.ClientSession;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;

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
                             int maxPlayers) throws IOException, InterruptedException {
        Map<String, Object> payload = new HashMap<>();
        payload.put("gameType", gameType);
        payload.put("name", defaultName);
        payload.put("maxPlayers", maxPlayers);
        RoomResponseDto response = restClient.post("rooms/", payload, RoomResponseDto.class);
        if (response == null || response.id() <= 0) {
            throw new IOException("Identifiant de salle invalide pour " + gameType);
        }
        return response.id();
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
