package com.lemondelila.client.framework.network.rest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.framework.core.config.ConfigurationService;
import com.lemondelila.client.framework.core.di.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Collections;
import java.util.Map;
import java.util.Objects;

public final class RestClient {

    private static final Logger LOGGER = LoggerFactory.getLogger(RestClient.class);

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final URI baseUri;

    public RestClient(HttpClient httpClient, ObjectMapper objectMapper, URI baseUri) {
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
        this.baseUri = Objects.requireNonNull(baseUri, "baseUri");
    }

    @Inject
    public RestClient(HttpClient httpClient, ObjectMapper objectMapper, ConfigurationService configurationService) {
        this(httpClient, objectMapper, URI.create(configurationService.get("network.http.base", "http://127.0.0.1:8000/api/")));
    }

    public JsonNode get(String path) throws IOException, InterruptedException {
        return get(path, Collections.emptyMap());
    }

    public JsonNode get(String path, Map<String, String> headers) throws IOException, InterruptedException {
        HttpRequest.Builder builder = HttpRequest.newBuilder(baseUri.resolve(path))
                .GET()
                .timeout(Duration.ofSeconds(10));
        headers.forEach(builder::header);
        HttpRequest request = builder.build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        return parseNode(response);
    }

    public <T> T get(String path, Map<String, String> headers, Class<T> type) throws IOException, InterruptedException {
        HttpRequest.Builder builder = HttpRequest.newBuilder(baseUri.resolve(path))
                .GET()
                .timeout(Duration.ofSeconds(10));
        headers.forEach(builder::header);
        HttpRequest request = builder.build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        return parse(response, type);
    }

    public JsonNode post(String path, Map<String, Object> payload) throws IOException, InterruptedException {
        return post(path, Collections.emptyMap(), payload);
    }

    public JsonNode post(String path,
                         Map<String, String> headers,
                         Map<String, Object> payload) throws IOException, InterruptedException {
        return post(path, headers, payload, JsonNode.class);
    }

    public <T> T post(String path,
                      Map<String, Object> payload,
                      Class<T> type) throws IOException, InterruptedException {
        return post(path, Collections.emptyMap(), payload, type);
    }

    public <T> T post(String path,
                      Map<String, String> headers,
                      Map<String, Object> payload,
                      Class<T> type) throws IOException, InterruptedException {
        String body = objectMapper.writeValueAsString(payload);
        HttpRequest.Builder builder = HttpRequest.newBuilder(baseUri.resolve(path))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body));
        headers.forEach(builder::header);
        HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        if (type == JsonNode.class) {
            return type.cast(parseNode(response));
        }
        return parse(response, type);
    }

    public JsonNode delete(String path, Map<String, String> headers) throws IOException, InterruptedException {
        HttpRequest.Builder builder = HttpRequest.newBuilder(baseUri.resolve(path))
                .timeout(Duration.ofSeconds(10))
                .DELETE();
        headers.forEach(builder::header);
        HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        return parseNode(response);
    }

    public <T> T delete(String path, Map<String, String> headers, Class<T> type) throws IOException, InterruptedException {
        HttpRequest.Builder builder = HttpRequest.newBuilder(baseUri.resolve(path))
                .timeout(Duration.ofSeconds(10))
                .DELETE();
        headers.forEach(builder::header);
        HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        if (type == JsonNode.class) {
            return type.cast(parseNode(response));
        }
        return parse(response, type);
    }

    private JsonNode parseNode(HttpResponse<String> response) throws IOException {
        ensureSuccess(response);
        String body = response.body();
        try {
            return objectMapper.readTree(body);
        } catch (IOException ex) {
            LOGGER.error("Impossible d'analyser la reponse HTTP {}: {}", response.statusCode(), body, ex);
            throw ex;
        }
    }

    private <T> T parse(HttpResponse<String> response, Class<T> type) throws IOException {
        ensureSuccess(response);
        String body = response.body();
        try {
            return objectMapper.readValue(body, type);
        } catch (IOException ex) {
            LOGGER.error("Impossible de deserialiser la reponse HTTP {}: {}", response.statusCode(), body, ex);
            throw ex;
        }
    }

    private void ensureSuccess(HttpResponse<String> response) throws IOException {
        if (response.statusCode() >= 400) {
            String body = response.body();
            LOGGER.warn("Reponse HTTP {}: {}", response.statusCode(), body);
            throw new IOException("HTTP " + response.statusCode() + ": " + body);
        }
    }
}
