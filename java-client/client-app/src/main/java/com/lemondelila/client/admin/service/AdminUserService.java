package com.lemondelila.client.admin.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.admin.dto.AdminCreateUserResult;
import com.lemondelila.client.admin.dto.AdminResetPasswordResult;
import com.lemondelila.client.admin.dto.AdminUser;
import com.lemondelila.client.admin.dto.AdminUserCreateRequest;
import com.lemondelila.client.admin.dto.AdminUserUpdateRequest;
import com.lemondelila.client.admin.dto.AdminUserPage;
import com.lemondelila.client.admin.dto.AdminBanRequest;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.network.config.NetworkEndpoints;
import com.lemondelila.client.user.model.ClientSession;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

public final class AdminUserService {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final NetworkEndpoints endpoints;
    private final ClientSession session;
    private final TaskScheduler scheduler;

    @Inject
    public AdminUserService(HttpClient httpClient,
                            ObjectMapper objectMapper,
                            NetworkEndpoints endpoints,
                            ClientSession session,
                            TaskScheduler scheduler) {
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
        this.endpoints = Objects.requireNonNull(endpoints, "endpoints");
        this.session = Objects.requireNonNull(session, "session");
        this.scheduler = Objects.requireNonNull(scheduler, "scheduler");
    }

    public CompletableFuture<AdminUserPage> listUsers(int page, int limit, String search, String role) {
        Map<String, String> params = new HashMap<>();
        params.put("page", String.valueOf(page > 0 ? page : 1));
        params.put("limit", String.valueOf(limit > 0 ? Math.min(limit, 100) : 20));
        if (search != null && !search.isBlank()) {
            params.put("search", search.trim());
        }
        return sendGet("admin/users", params, AdminUserPage.class);
    }

    public CompletableFuture<AdminCreateUserResult> createUser(AdminUserCreateRequest request) {
        return sendJson("admin/users", "POST", request, AdminCreateUserResult.class);
    }

    public CompletableFuture<AdminUser> updateUser(int userId, AdminUserUpdateRequest request) {
        String path = "admin/users/" + userId;
        return sendJson(path, "PATCH", request, AdminUser.class);
    }

    public CompletableFuture<AdminResetPasswordResult> resetPassword(int userId) {
        String path = "admin/users/" + userId + "/reset-password";
        return sendJson(path, "POST", Map.of(), AdminResetPasswordResult.class);
    }

    public CompletableFuture<AdminUser> banUser(int userId, AdminBanRequest request) {
        String path = "admin/users/" + userId + "/ban";
        return sendJson(path, "POST", request, AdminUser.class);
    }

    public CompletableFuture<AdminUser> unbanUser(int userId) {
        String path = "admin/users/" + userId + "/unban";
        return sendJson(path, "POST", Map.of(), AdminUser.class);
    }

    public CompletableFuture<Void> deleteUser(int userId) {
        String path = "admin/users/" + userId;
        CompletableFuture<Void> future = new CompletableFuture<>();
        scheduler.runAsync(() -> {
            try {
                HttpRequest request = baseBuilder(buildUri(path))
                        .header("Content-Type", "application/json")
                        .DELETE()
                        .build();
                send(request, Void.class);
                future.complete(null);
            } catch (Exception ex) {
                future.completeExceptionally(ex);
            }
        });
        return future;
    }

    private <T> CompletableFuture<T> sendGet(String path, Map<String, String> params, Class<T> resultClass) {
        CompletableFuture<T> future = new CompletableFuture<>();
        scheduler.runAsync(() -> {
            try {
                String query = buildQuery(params);
                URI uri = buildUri(path + (query.isBlank() ? "" : "?" + query));
                HttpRequest request = baseBuilder(uri).GET().build();
                T result = send(request, resultClass);
                future.complete(result);
            } catch (Exception ex) {
                future.completeExceptionally(ex);
            }
        });
        return future;
    }

    private <T> CompletableFuture<T> sendJson(String path, String method, Object payload, Class<T> resultClass) {
        CompletableFuture<T> future = new CompletableFuture<>();
        scheduler.runAsync(() -> {
            try {
                byte[] body = objectMapper.writeValueAsBytes(payload == null ? Map.of() : payload);
                HttpRequest.Builder builder = baseBuilder(buildUri(path))
                        .header("Content-Type", "application/json");
                if ("POST".equalsIgnoreCase(method)) {
                    builder.POST(HttpRequest.BodyPublishers.ofByteArray(body));
                } else if ("PATCH".equalsIgnoreCase(method)) {
                    builder.method("PATCH", HttpRequest.BodyPublishers.ofByteArray(body));
                } else {
                    builder.method(method.toUpperCase(), HttpRequest.BodyPublishers.ofByteArray(body));
                }
                T result = send(builder.build(), resultClass);
                future.complete(result);
            } catch (Exception ex) {
                future.completeExceptionally(ex);
            }
        });
        return future;
    }

    private <T> T send(HttpRequest request, Class<T> resultClass) throws IOException, InterruptedException {
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        int status = response.statusCode();
        if (status == 401 || status == 403) {
            throw new IOException("Accès refusé (session expirée ou droits insuffisants).");
        }
        if (status >= 400) {
            throw new IOException("HTTP " + status + " : " + response.body());
        }
        if (resultClass == Void.class) {
            return null;
        }
        return objectMapper.readValue(response.body(), resultClass);
    }

    private HttpRequest.Builder baseBuilder(URI uri) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri)
                .timeout(TIMEOUT)
                .header("Accept", "application/json");
        Optional<ClientSession.AuthState> auth = session.authenticated();
        auth.map(ClientSession.AuthState::token)
                .filter(token -> !token.isBlank())
                .ifPresent(token -> builder.header("Authorization", "Bearer " + token));
        return builder;
    }

    private URI buildUri(String path) {
        String base = endpoints.httpBase().toString();
        if (!base.endsWith("/")) {
            base = base + "/";
        }
        return URI.create(base + path);
    }

    private String buildQuery(Map<String, String> params) {
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> entry : params.entrySet()) {
            if (entry.getValue() == null || entry.getValue().isBlank()) {
                continue;
            }
            if (sb.length() > 0) {
                sb.append('&');
            }
            sb.append(urlEncode(entry.getKey())).append('=').append(urlEncode(entry.getValue()));
        }
        return sb.toString();
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
