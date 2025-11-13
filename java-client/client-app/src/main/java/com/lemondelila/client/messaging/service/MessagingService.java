package com.lemondelila.client.messaging.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.messaging.model.PrivateMessage;
import com.lemondelila.client.user.model.ClientSession;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

public final class MessagingService {

    private final RestClient restClient;
    private final TaskScheduler scheduler;
    private final ClientSession session;

    @Inject
    public MessagingService(RestClient restClient,
                            TaskScheduler scheduler,
                            ClientSession session) {
        this.restClient = Objects.requireNonNull(restClient, "restClient");
        this.scheduler = Objects.requireNonNull(scheduler, "scheduler");
        this.session = Objects.requireNonNull(session, "session");
    }

    public CompletableFuture<List<PrivateMessage>> loadConversation(int userId, int limit) {
        CompletableFuture<List<PrivateMessage>> future = new CompletableFuture<>();
        scheduler.runAsync(() -> {
            try {
                JsonNode response = restClient.get(
                        "messaging/conversations/" + userId + "?limit=" + clamp(limit),
                        authHeaders());
                List<PrivateMessage> messages = parseMessages(response.path("items"));
                future.complete(messages);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                future.completeExceptionally(new IOException("Chargement interrompu", e));
            } catch (Exception e) {
                future.completeExceptionally(e);
            }
        });
        return future;
    }

    public CompletableFuture<PrivateMessage> sendMessage(int recipientId, String text) {
        CompletableFuture<PrivateMessage> future = new CompletableFuture<>();
        scheduler.runAsync(() -> {
            try {
                JsonNode response = restClient.post(
                        "messaging/messages",
                        authHeaders(),
                        Map.of("recipientId", recipientId, "text", text));
                JsonNode messageNode = response.path("message");
                PrivateMessage message = parseMessage(messageNode);
                future.complete(message);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                future.completeExceptionally(new IOException("Envoi interrompu", e));
            } catch (Exception e) {
                future.completeExceptionally(e);
            }
        });
        return future;
    }

    public CompletableFuture<List<PrivateMessage>> loadInbox(int limit) {
        return loadBox("inbox", limit);
    }

    public CompletableFuture<List<PrivateMessage>> loadOutbox(int limit) {
        return loadBox("outbox", limit);
    }

    public CompletableFuture<List<PrivateMessage>> loadDeleted(int limit) {
        return loadBox("deleted", limit);
    }

    public CompletableFuture<PrivateMessage> deleteMessage(String messageId) {
        CompletableFuture<PrivateMessage> future = new CompletableFuture<>();
        scheduler.runAsync(() -> {
            try {
                JsonNode response = restClient.delete(
                        "messaging/messages/" + messageId,
                        authHeaders());
                JsonNode messageNode = response.path("message");
                future.complete(parseMessage(messageNode));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                future.completeExceptionally(new IOException("Suppression interrompue", e));
            } catch (Exception e) {
                future.completeExceptionally(e);
            }
        });
        return future;
    }

    public CompletableFuture<PrivateMessage> restoreMessage(String messageId) {
        CompletableFuture<PrivateMessage> future = new CompletableFuture<>();
        scheduler.runAsync(() -> {
            try {
                JsonNode response = restClient.post(
                        "messaging/messages/" + messageId + "/restore",
                        authHeaders(),
                        Map.of());
                JsonNode messageNode = response.path("message");
                future.complete(parseMessage(messageNode));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                future.completeExceptionally(new IOException("Restauration interrompue", e));
            } catch (Exception e) {
                future.completeExceptionally(e);
            }
        });
        return future;
    }

    public CompletableFuture<KnownUser> lookupUser(String username) {
        CompletableFuture<KnownUser> future = new CompletableFuture<>();
        scheduler.runAsync(() -> {
            try {
                String encoded = URLEncoder.encode(username, StandardCharsets.UTF_8);
                JsonNode response = restClient.get(
                        "messaging/users/search?username=" + encoded,
                        authHeaders());
                JsonNode userNode = response.path("user");
                if (!userNode.isObject()) {
                    throw new IOException("Réponse de recherche invalide.");
                }
                int id = userNode.path("id").asInt(-1);
                if (id <= 0) {
                    throw new IOException("Utilisateur introuvable.");
                }
                String resolvedUsername = userNode.path("username").asText("");
                future.complete(new KnownUser(id, resolvedUsername));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                future.completeExceptionally(new IOException("Recherche interrompue", e));
            } catch (Exception e) {
                future.completeExceptionally(e);
            }
        });
        return future;
    }

    private CompletableFuture<List<PrivateMessage>> loadBox(String box, int limit) {
        CompletableFuture<List<PrivateMessage>> future = new CompletableFuture<>();
        scheduler.runAsync(() -> {
            try {
                JsonNode response = restClient.get(
                        "messaging/messages?box=" + box + "&limit=" + clamp(limit),
                        authHeaders());
                List<PrivateMessage> messages = parseMessages(response.path("items"));
                future.complete(messages);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                future.completeExceptionally(new IOException("Chargement interrompu", e));
            } catch (Exception e) {
                future.completeExceptionally(e);
            }
        });
        return future;
    }

    private Map<String, String> authHeaders() {
        Map<String, String> headers = new HashMap<>();
        session.authenticated().ifPresent(auth ->
                headers.put("Authorization", "Bearer " + auth.token()));
        return headers;
    }

    private List<PrivateMessage> parseMessages(JsonNode itemsNode) throws IOException {
        if (!itemsNode.isArray()) {
            throw new IOException("Reponse messagerie invalide");
        }
        List<PrivateMessage> messages = new ArrayList<>();
        for (JsonNode node : itemsNode) {
            PrivateMessage message = parseMessage(node);
            if (message != null) {
                messages.add(message);
            }
        }
        return List.copyOf(messages);
    }

    private PrivateMessage parseMessage(JsonNode node) throws IOException {
        if (!node.isObject()) {
            throw new IOException("Message prive invalide");
        }
        JsonNode senderNode = node.path("sender");
        JsonNode recipientNode = node.path("recipient");
        if (!senderNode.isObject() || !recipientNode.isObject()) {
            throw new IOException("Participants du message prive invalides");
        }
        String id = node.path("id").asText("");
        String text = node.path("text").asText("");
        Instant createdAt = parseInstant(node.path("createdAt").asText(""));
        String direction = node.path("direction").asText("");
        Instant deletedAt = parseOptionalInstant(node.path("deletedAt").asText(""));
        if (direction.isBlank()) {
            String currentUsername = session.authenticated()
                    .map(ClientSession.AuthState::username)
                    .orElse("");
            if (!currentUsername.isBlank()
                    && currentUsername.equalsIgnoreCase(senderNode.path("username").asText(""))) {
                direction = "sent";
            } else {
                direction = "received";
            }
        }
        return new PrivateMessage(
                id,
                senderNode.path("id").asInt(-1),
                senderNode.path("username").asText(""),
                recipientNode.path("id").asInt(-1),
                recipientNode.path("username").asText(""),
                text,
                createdAt,
                direction,
                deletedAt
        );
    }

    private Instant parseInstant(String iso) {
        if (iso == null || iso.isBlank()) {
            return Instant.now();
        }
        try {
            return Instant.parse(iso);
        } catch (Exception ignored) {
            return Instant.now();
        }
    }

    private Instant parseOptionalInstant(String iso) {
        if (iso == null || iso.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(iso);
        } catch (Exception ignored) {
            return null;
        }
    }

    private int clamp(int limit) {
        return Math.max(1, Math.min(500, limit));
    }

    public record KnownUser(int id, String username) {
    }
}
