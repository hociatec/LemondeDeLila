package com.lemondelila.client.framework.network.rest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.Authenticator;
import java.net.CookieHandler;
import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpClient.Version;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.function.Supplier;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSession;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RestClientTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void should_merge_provider_headers_with_request_headers() throws Exception {
        List<HttpRequest> recorded = new ArrayList<>();
        HttpClient httpClient = new RecordingHttpClient(() -> new FakeHttpResponse(200, "{\"ok\":true}"), recorded);
        RestHeadersProvider provider = () -> Map.of("X-Provider", "value");
        RestClient client = new RestClient(httpClient, MAPPER, URI.create("http://example.com/"), provider, RetryStrategy.NONE);

        JsonNode node = client.get("catalog", Map.of("X-Request", "request"));
        assertTrue(node.path("ok").asBoolean());

        HttpRequest sent = recorded.get(0);
        assertEquals("value", sent.headers().firstValue("X-Provider").orElse(null));
        assertEquals("request", sent.headers().firstValue("X-Request").orElse(null));
    }

    @Test
    void should_retry_when_retry_strategy_allows() throws Exception {
        List<HttpRequest> recorded = new ArrayList<>();
        RecordingHttpClient httpClient = new RecordingHttpClient(
                List.of(new IOException("boom"), new FakeHttpResponse(200, "{\"ok\":true}")),
                recorded
        );
        RetryStrategy retryStrategy = new RetryStrategy() {
            @Override
            public boolean shouldRetry(int attempt, IOException failure) {
                return attempt < 3;
            }

            @Override
            public Duration nextDelay(int attempt) {
                return Duration.ZERO;
            }
        };
        RestClient client = new RestClient(httpClient, MAPPER, URI.create("http://example.com/"), RestHeadersProvider.empty(), retryStrategy);

        JsonNode node = client.get("retry");
        assertTrue(node.path("ok").asBoolean());
        assertEquals(2, recorded.size());
    }

    private static final class RecordingHttpClient extends HttpClient {

        private final ArrayDeque<Object> responses;
        private final List<HttpRequest> recordedRequests;

        RecordingHttpClient(Supplier<Object> singleResponse, List<HttpRequest> recordedRequests) {
            this.responses = new ArrayDeque<>();
            this.responses.add(singleResponse.get());
            this.recordedRequests = recordedRequests;
        }

        RecordingHttpClient(List<Object> responses, List<HttpRequest> recordedRequests) {
            this.responses = new ArrayDeque<>(responses);
            this.recordedRequests = recordedRequests;
        }

        @Override
        public <T> HttpResponse<T> send(HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler) throws IOException, InterruptedException {
            recordedRequests.add(request);
            Object next = responses.poll();
            if (next == null) {
                throw new AssertionError("No more responses");
            }
            if (next instanceof IOException ioException) {
                throw ioException;
            }
            @SuppressWarnings("unchecked")
            HttpResponse<T> response = (HttpResponse<T>) next;
            return response;
        }

        @Override
        public <T> CompletableFuture<HttpResponse<T>> sendAsync(HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler) {
            throw new UnsupportedOperationException("sendAsync not supported");
        }

        @Override
        public <T> CompletableFuture<HttpResponse<T>> sendAsync(HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler, HttpResponse.PushPromiseHandler<T> pushPromiseHandler) {
            throw new UnsupportedOperationException("sendAsync not supported");
        }

        @Override
        public Optional<Duration> connectTimeout() {
            return Optional.of(Duration.ofSeconds(1));
        }

        @Override
        public Optional<CookieHandler> cookieHandler() {
            return Optional.empty();
        }

        @Override
        public Redirect followRedirects() {
            return Redirect.NEVER;
        }

        @Override
        public Optional<ProxySelector> proxy() {
            return Optional.empty();
        }

        @Override
        public SSLContext sslContext() {
            return null;
        }

        @Override
        public SSLParameters sslParameters() {
            return null;
        }

        @Override
        public Optional<Authenticator> authenticator() {
            return Optional.empty();
        }

        @Override
        public Version version() {
            return Version.HTTP_1_1;
        }

        @Override
        public Optional<Executor> executor() {
            return Optional.empty();
        }
    }

    private static final class FakeHttpResponse implements HttpResponse<String> {

        private final int status;
        private final String body;

        FakeHttpResponse(int status, String body) {
            this.status = status;
            this.body = body;
        }

        @Override
        public int statusCode() {
            return status;
        }

        @Override
        public HttpRequest request() {
            return null;
        }

        @Override
        public Optional<HttpResponse<String>> previousResponse() {
            return Optional.empty();
        }

        @Override
        public HttpHeaders headers() {
            return HttpHeaders.of(Collections.emptyMap(), (a, b) -> true);
        }

        @Override
        public String body() {
            return body;
        }

        @Override
        public Optional<SSLSession> sslSession() {
            return Optional.empty();
        }

        @Override
        public URI uri() {
            return URI.create("http://example.com");
        }

        @Override
        public Version version() {
            return Version.HTTP_1_1;
        }
    }
}
