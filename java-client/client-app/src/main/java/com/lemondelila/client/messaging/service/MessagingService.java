package com.lemondelila.client.messaging.service;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.messaging.model.PrivateMessage;
import com.lemondelila.client.messaging.dto.MessageDto;
import com.lemondelila.client.messaging.dto.MessageResponseDto;
import com.lemondelila.client.messaging.dto.MessagesResponseDto;
import com.lemondelila.client.messaging.dto.UserLookupResponseDto;
import com.lemondelila.client.messaging.dto.MessageUserDto;
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
                MessagesResponseDto response = restClient.get(
                        "messaging/conversations/" + userId + "?limit=" + clamp(limit),
                        authHeaders(),
                        MessagesResponseDto.class);
                future.complete(toMessages(response.items()));
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
                MessageResponseDto response = restClient.post(
                        "messaging/messages",
                        authHeaders(),
                        Map.of("recipientId", recipientId, "text", text),
                        MessageResponseDto.class);
                future.complete(toMessage(response.message()));
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
                MessageResponseDto response = restClient.delete(
                        "messaging/messages/" + messageId,
                        authHeaders(),
                        MessageResponseDto.class);
                future.complete(toMessage(response.message()));
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
                MessageResponseDto response = restClient.post(
                        "messaging/messages/" + messageId + "/restore",
                        authHeaders(),
                        Map.of(),
                        MessageResponseDto.class);
                future.complete(toMessage(response.message()));
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
                UserLookupResponseDto response = restClient.get(
                        "messaging/users/search?username=" + encoded,
                        authHeaders(),
                        UserLookupResponseDto.class);
                MessageUserDto user = response.user();
                if (user == null || user.id() <= 0 || user.username() == null || user.username().isBlank()) {
                    throw new IOException("Utilisateur introuvable.");
                }
                future.complete(new KnownUser(user.id(), user.username()));
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
                MessagesResponseDto response = restClient.get(
                        "messaging/messages?box=" + box + "&limit=" + clamp(limit),
                        authHeaders(),
                        MessagesResponseDto.class);
                future.complete(toMessages(response.items()));
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

    private List<PrivateMessage> toMessages(List<MessageDto> dtos) throws IOException {
        if (dtos == null || dtos.isEmpty()) {
            return List.of();
        }
        List<PrivateMessage> messages = new ArrayList<>(dtos.size());
        for (MessageDto dto : dtos) {
            messages.add(toMessage(dto));
        }
        return List.copyOf(messages);
    }

    private PrivateMessage toMessage(MessageDto dto) throws IOException {
        if (dto == null) {
            throw new IOException("Message prive invalide");
        }
        MessageUserDto sender = dto.sender();
        MessageUserDto recipient = dto.recipient();
        if (sender == null || recipient == null) {
            throw new IOException("Participants du message prive invalides");
        }
        String direction = dto.direction();
        if (direction == null || direction.isBlank()) {
            String currentUsername = session.authenticated()
                    .map(ClientSession.AuthState::username)
                    .orElse("");
            if (!currentUsername.isBlank()
                    && currentUsername.equalsIgnoreCase(sender.username())) {
                direction = "sent";
            } else {
                direction = "received";
            }
        }
        return new PrivateMessage(
                dto.id(),
                sender.id(),
                sender.username(),
                recipient.id(),
                recipient.username(),
                dto.text(),
                parseInstant(dto.createdAt()),
                direction,
                parseOptionalInstant(dto.deletedAt())
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
