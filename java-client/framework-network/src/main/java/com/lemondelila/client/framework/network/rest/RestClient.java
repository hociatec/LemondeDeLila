package com.lemondelila.client.framework.network.rest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.network.config.NetworkEndpoints;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;

public final class RestClient {

    private static final Logger LOGGER = LoggerFactory.getLogger(RestClient.class);
    private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(10);

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final URI baseUri;
    private final RestHeadersProvider headersProvider;
    private final RetryStrategy retryStrategy;
    private final Duration timeout;
    private final UnauthorizedHandler unauthorizedHandler;

    public RestClient(HttpClient httpClient,
                      ObjectMapper objectMapper,
                      URI baseUri) {
        this(httpClient, objectMapper, baseUri, RestHeadersProvider.empty(), RetryStrategy.NONE, DEFAULT_TIMEOUT, UnauthorizedHandler.NONE);
    }

    public RestClient(HttpClient httpClient,
                      ObjectMapper objectMapper,
                      URI baseUri,
                      RestHeadersProvider headersProvider,
                      RetryStrategy retryStrategy) {
        this(httpClient, objectMapper, baseUri, headersProvider, retryStrategy, DEFAULT_TIMEOUT, UnauthorizedHandler.NONE);
    }

    public RestClient(HttpClient httpClient,
                      ObjectMapper objectMapper,
                      URI baseUri,
                      RestHeadersProvider headersProvider,
                      RetryStrategy retryStrategy,
                      Duration timeout) {
        this(httpClient, objectMapper, baseUri, headersProvider, retryStrategy, timeout, UnauthorizedHandler.NONE);
    }

    public RestClient(HttpClient httpClient,
                      ObjectMapper objectMapper,
                      URI baseUri,
                      RestHeadersProvider headersProvider,
                      RetryStrategy retryStrategy,
                      UnauthorizedHandler unauthorizedHandler) {
        this(httpClient, objectMapper, baseUri, headersProvider, retryStrategy, DEFAULT_TIMEOUT, unauthorizedHandler);
    }

    public RestClient(HttpClient httpClient,
                      ObjectMapper objectMapper,
                      URI baseUri,
                      RestHeadersProvider headersProvider,
                      RetryStrategy retryStrategy,
                      Duration timeout,
                      UnauthorizedHandler unauthorizedHandler) {
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
        this.baseUri = Objects.requireNonNull(baseUri, "baseUri");
        this.headersProvider = headersProvider == null ? RestHeadersProvider.empty() : headersProvider;
        this.retryStrategy = retryStrategy == null ? RetryStrategy.NONE : retryStrategy;
        this.timeout = timeout == null ? DEFAULT_TIMEOUT : timeout;
        this.unauthorizedHandler = unauthorizedHandler == null ? UnauthorizedHandler.NONE : unauthorizedHandler;
    }

    @Inject
    public RestClient(HttpClient httpClient,
                      ObjectMapper objectMapper,
                      NetworkEndpoints endpoints,
                      RestHeadersProvider headersProvider,
                      RetryStrategy retryStrategy,
                      UnauthorizedHandler unauthorizedHandler) {
        this(httpClient,
                objectMapper,
                endpoints.httpBase(),
                headersProvider,
                retryStrategy,
                DEFAULT_TIMEOUT,
                unauthorizedHandler);
    }

    public JsonNode get(String path) throws IOException, InterruptedException {
        return get(path, Collections.emptyMap());
    }

    public JsonNode get(String path, Map<String, String> headers) throws IOException, InterruptedException {
        HttpResponse<String> response = execute(() -> buildRequest(path, HttpMethod.GET, headers, null));
        return parseNode(response);
    }

    public <T> T get(String path, Class<T> type) throws IOException, InterruptedException {
        return get(path, Collections.emptyMap(), type);
    }

    public <T> T get(String path, Map<String, String> headers, Class<T> type) throws IOException, InterruptedException {
        HttpResponse<String> response = execute(() -> buildRequest(path, HttpMethod.GET, headers, null));
        return parse(response, type);
    }

    public JsonNode post(String path, Map<String, Object> payload) throws IOException, InterruptedException {
        return post(path, Collections.emptyMap(), payload);
    }

    public JsonNode post(String path, Map<String, String> headers, Map<String, Object> payload) throws IOException, InterruptedException {
        return post(path, headers, payload, JsonNode.class);
    }

    public <T> T post(String path, Map<String, Object> payload, Class<T> type) throws IOException, InterruptedException {
        return post(path, Collections.emptyMap(), payload, type);
    }

    public <T> T post(String path, Map<String, String> headers, Map<String, Object> payload, Class<T> type) throws IOException, InterruptedException {
        String body = objectMapper.writeValueAsString(payload == null ? Collections.emptyMap() : payload);
        HttpResponse<String> response = execute(() -> buildRequest(path, HttpMethod.POST, headers, body));
        if (type == JsonNode.class) {
            return type.cast(parseNode(response));
        }
        return parse(response, type);
    }

    public JsonNode delete(String path, Map<String, String> headers) throws IOException, InterruptedException {
        HttpResponse<String> response = execute(() -> buildRequest(path, HttpMethod.DELETE, headers, null));
        return parseNode(response);
    }

    public JsonNode delete(String path) throws IOException, InterruptedException {
        return delete(path, Collections.emptyMap());
    }

    public <T> T delete(String path, Class<T> type) throws IOException, InterruptedException {
        return delete(path, Collections.emptyMap(), type);
    }

    public <T> T delete(String path, Map<String, String> headers, Class<T> type) throws IOException, InterruptedException {
        HttpResponse<String> response = execute(() -> buildRequest(path, HttpMethod.DELETE, headers, null));
        if (type == JsonNode.class) {
            return type.cast(parseNode(response));
        }
        return parse(response, type);
    }

    private HttpResponse<String> execute(Supplier<HttpRequest> requestSupplier) throws IOException, InterruptedException {
        int attempt = 0;
        while (true) {
            HttpRequest request = requestSupplier.get();
            LOGGER.debug("Envoi requête {} {}", request.method(), request.uri());
            try {
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                LOGGER.trace("Réponse HTTP {} {}", response.statusCode(), request.uri());
                return response;
            } catch (IOException ex) {
                attempt++;
                if (!retryStrategy.shouldRetry(attempt, ex)) {
                    throw ex;
                }
                Duration delay = retryStrategy.nextDelay(attempt);
                if (!delay.isZero()) {
                    try {
                        Thread.sleep(delay.toMillis());
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                        throw interrupted;
                    }
                }
                LOGGER.debug("Nouvelle tentative HTTP {} après erreur {} (tentative #{})", request.uri(), ex.getMessage(), attempt + 1);
            }
        }
    }

    private HttpRequest buildRequest(String path, HttpMethod method, Map<String, String> headers, String body) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(baseUri.resolve(path))
                .timeout(timeout);
        applyHeaders(builder, headers);
        if (method == HttpMethod.GET) {
            builder.GET();
        } else if (method == HttpMethod.DELETE) {
            builder.DELETE();
        } else if (method == HttpMethod.POST) {
            builder.header("Content-Type", "application/json");
            builder.POST(HttpRequest.BodyPublishers.ofString(body == null ? "" : body));
        }
        return builder.build();
    }

    private void applyHeaders(HttpRequest.Builder builder, Map<String, String> headers) {
        mergeHeaders(headers).forEach(builder::header);
    }

    private Map<String, String> mergeHeaders(Map<String, String> headers) {
        Map<String, String> combined = new LinkedHashMap<>();
        Map<String, String> baseHeaders = headersProvider.headers();
        if (baseHeaders != null) {
            baseHeaders.forEach((key, value) -> combined.put(key, value));
        }
        if (headers != null) {
            headers.forEach((key, value) -> combined.put(key, value));
        }
        return combined;
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
        if (response.statusCode() == 401 || response.statusCode() == 403) {
            unauthorizedHandler.onUnauthorized(response);
        }
        if (response.statusCode() >= 400) {
            String body = response.body();
            LOGGER.warn("Reponse HTTP {}: {}", response.statusCode(), body);
            throw new IOException("HTTP " + response.statusCode() + ": " + body);
        }
    }

    private enum HttpMethod {
        GET,
        POST,
        DELETE
    }
}
