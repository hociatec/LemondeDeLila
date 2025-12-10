package com.lemondelila.client.network;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.network.config.NetworkEndpoints;
import com.lemondelila.client.framework.network.ws.RealtimeGateway;
import com.lemondelila.client.framework.network.ws.StandardRealtimeGateway;
import com.lemondelila.client.user.model.ClientSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.Closeable;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Client léger pour l'API WS (/ws/api) avec corrélation requestId.
 * Ouvre une connexion par requête pour éviter de gérer un pool d'états côté client.
 */
public final class RealtimeApiClient implements Closeable {

    private static final Logger LOGGER = LoggerFactory.getLogger(RealtimeApiClient.class);
    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    private final HttpClient httpClient;
    private final ObjectMapper mapper;
    private final DomainEventBus eventBus;
    private final NetworkEndpoints endpoints;
    private final ClientSession session;

    public RealtimeApiClient(HttpClient httpClient,
                             ObjectMapper mapper,
                             DomainEventBus eventBus,
                             NetworkEndpoints endpoints,
                             ClientSession session) {
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.eventBus = Objects.requireNonNull(eventBus, "eventBus");
        this.endpoints = Objects.requireNonNull(endpoints, "endpoints");
        this.session = Objects.requireNonNull(session, "session");
    }

    public <T> T request(String type, Object payload, Class<T> responsePayloadClass) throws IOException, InterruptedException {
        Objects.requireNonNull(type, "type");
        URI endpoint = endpoints.apiGateway(resolveToken());

        Map<String, CompletableFuture<JsonNode>> inflight = new ConcurrentHashMap<>();
        StandardRealtimeGateway gateway = new StandardRealtimeGateway(httpClient, () -> endpoint, mapper, eventBus);
        CompletableFuture<Void> connected = new CompletableFuture<>();
        gateway.onConnectionState(state -> {
            if (state == RealtimeGateway.ConnectionState.CONNECTED) {
                connected.complete(null);
            }
        });
        gateway.onMessage(node -> {
            String requestId = node.path("requestId").asText("");
            if (requestId.isBlank()) {
                return;
            }
            CompletableFuture<JsonNode> future = inflight.remove(requestId);
            if (future != null) {
                future.complete(node);
            }
        });
        gateway.connect();
        try {
            connected.get(TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
        } catch (Exception ex) {
            gateway.close();
            throw new IOException("Connexion WS API impossible", ex);
        }

        String requestId = UUID.randomUUID().toString();
        CompletableFuture<JsonNode> future = new CompletableFuture<>();
        inflight.put(requestId, future);

        ObjectNode message = mapper.createObjectNode();
        message.put("type", type);
        message.put("requestId", requestId);
        message.set("payload", payload == null ? mapper.createObjectNode() : mapper.valueToTree(payload));
        gateway.send(message);

        try {
            JsonNode response = future.get(TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
            if ("error".equals(response.path("type").asText())) {
                String msg = response.path("payload").path("message").asText("Erreur WS");
                throw new IOException(msg);
            }
            JsonNode payloadNode = response.path("payload");
            if (responsePayloadClass == JsonNode.class) {
                @SuppressWarnings("unchecked")
                T casted = (T) payloadNode;
                return casted;
            }
            return mapper.treeToValue(payloadNode, responsePayloadClass);
        } catch (IOException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IOException("Réponse WS indisponible", ex);
        } finally {
            inflight.clear();
            gateway.close();
        }
    }

    private String resolveToken() {
        Optional<ClientSession.AuthState> auth = session.authenticated();
        return auth.map(ClientSession.AuthState::token).orElse(null);
    }

    @Override
    public void close() {
        // Rien à fermer (connexion par requête)
    }
}
