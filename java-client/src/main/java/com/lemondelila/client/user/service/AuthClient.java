package com.lemondelila.client.user.service;

import com.lemondelila.client.user.model.UserCredentials;
import com.lemondelila.client.user.model.UserRegistration;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Client HTTP minimaliste pour appeler l'API d'authentification.
 */
public final class AuthClient {

    private static final Pattern JSON_STRING_PATTERN =
            Pattern.compile("\\\"(?<key>[^\\\"]+)\\\"\\s*:\\s*\\\"(?<value>[^\\\"]*)\\\"");

    private final HttpClient httpClient;
    private final URI loginUri;
    private final URI registerUri;

    public AuthClient(URI loginUri, URI registerUri) {
        this.loginUri = Objects.requireNonNull(loginUri, "loginUri");
        this.registerUri = Objects.requireNonNull(registerUri, "registerUri");
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public AuthResult authenticate(UserCredentials credentials) {
        Objects.requireNonNull(credentials, "credentials");
        String jsonBody = buildLoginPayload(credentials);
        HttpRequest request = HttpRequest.newBuilder(loginUri)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .timeout(Duration.ofSeconds(10))
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            int status = response.statusCode();
            String body = response.body() == null ? "" : response.body();
            if (status >= 200 && status < 300) {
                String token = extractJsonValue(body, "token");
                if (token != null && !token.isBlank()) {
                    return AuthResult.success(token);
                }
                return AuthResult.failure("Reponse inattendue du serveur d'authentification.");
            }

            String error = extractJsonValue(body, "error");
            if (error == null || error.isBlank()) {
                error = String.format(Locale.ROOT, "Authentification refusee (HTTP %d).", status);
            }
            return AuthResult.failure(error);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return AuthResult.failure("La requete a ete interrompue.");
        } catch (IOException e) {
            return AuthResult.failure("Impossible de joindre le serveur: " + e.getMessage());
        }
    }

    public RegistrationResult register(UserRegistration registration) {
        Objects.requireNonNull(registration, "registration");
        String jsonBody = buildRegistrationPayload(registration);
        HttpRequest request = HttpRequest.newBuilder(registerUri)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .timeout(Duration.ofSeconds(10))
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            int status = response.statusCode();
            String body = response.body() == null ? "" : response.body();
            if (status >= 200 && status < 300) {
                String message = extractJsonValue(body, "message");
                if (message == null || message.isBlank()) {
                    message = "Inscription reussie.";
                }
                return RegistrationResult.success(message);
            }

            String error = extractJsonValue(body, "error");
            if (error == null || error.isBlank()) {
                error = extractJsonValue(body, "errors");
            }
            if (error == null || error.isBlank()) {
                error = String.format(Locale.ROOT, "Inscription refusee (HTTP %d).", status);
            }
            return RegistrationResult.failure(error);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return RegistrationResult.failure("La requete a ete interrompue.");
        } catch (IOException e) {
            return RegistrationResult.failure("Impossible de joindre le serveur: " + e.getMessage());
        }
    }

    private static String buildLoginPayload(UserCredentials credentials) {
        String escapedUsername = escapeJson(credentials.username());
        String escapedPassword = escapeJson(credentials.passwordAsString());
        return "{\"username\":\"" + escapedUsername + "\",\"password\":\"" + escapedPassword + "\"}";
    }

    private static String buildRegistrationPayload(UserRegistration registration) {
        String escapedUsername = escapeJson(registration.username());
        String escapedEmail = escapeJson(registration.email());
        String escapedPassword = escapeJson(registration.passwordAsString());
        return "{\"username\":\"" + escapedUsername + "\","
                + "\"email\":\"" + escapedEmail + "\","
                + "\"password\":\"" + escapedPassword + "\"}";
    }

    private static String escapeJson(String value) {
        StringBuilder builder = new StringBuilder();
        for (char c : value.toCharArray()) {
            switch (c) {
                case '\\', '"' -> builder.append('\\').append(c);
                case '\b' -> builder.append("\\b");
                case '\f' -> builder.append("\\f");
                case '\n' -> builder.append("\\n");
                case '\r' -> builder.append("\\r");
                case '\t' -> builder.append("\\t");
                default -> builder.append(c);
            }
        }
        return builder.toString();
    }

    private static String extractJsonValue(String json, String targetKey) {
        Matcher matcher = JSON_STRING_PATTERN.matcher(json);
        while (matcher.find()) {
            if (targetKey.equals(matcher.group("key"))) {
                return matcher.group("value");
            }
        }
        return null;
    }
}
