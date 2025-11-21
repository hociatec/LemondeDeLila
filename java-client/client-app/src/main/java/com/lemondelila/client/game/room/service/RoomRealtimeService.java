package com.lemondelila.client.game.room.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.network.config.NetworkEndpoints;
import com.lemondelila.client.game.room.event.RoomRealtimeEvent;
import com.lemondelila.client.game.room.event.RoomRealtimeFailed;
import com.lemondelila.client.game.room.model.RoomState;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Simple SSE client for /api/rooms/{id}/events.
 */
public final class RoomRealtimeService implements AutoCloseable {

    private static final Logger LOGGER = LoggerFactory.getLogger(RoomRealtimeService.class);
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final DomainEventBus eventBus;
    private final TaskScheduler scheduler;
    private final URI baseUri;
    private final AtomicReference<TaskScheduler.TaskHandle> current = new AtomicReference<>();
    private volatile boolean stopped = false;

    @Inject
    public RoomRealtimeService(HttpClient httpClient,
                               ObjectMapper objectMapper,
                               DomainEventBus eventBus,
                               TaskScheduler scheduler,
                               NetworkEndpoints endpoints) {
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.eventBus = eventBus;
        this.scheduler = scheduler;
        this.baseUri = endpoints.httpBase();
    }

    public AutoCloseable subscribe(int roomId) {
        stopped = false;
        TaskScheduler.TaskHandle handle = scheduler.submit("room-sse-" + roomId, () -> loop(roomId));
        current.set(handle);
        return () -> stop();
    }

    public void stop() {
        stopped = true;
        TaskScheduler.TaskHandle handle = current.getAndSet(null);
        if (handle != null) {
            handle.cancel(true);
        }
    }

    private void loop(int roomId) {
        while (!stopped) {
            try {
                connect(roomId);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            } catch (Exception e) {
                LOGGER.warn("SSE room {} interrompue : {}", roomId, e.getMessage());
                eventBus.publish(new RoomRealtimeFailed(roomId, clean(e.getMessage())));
            }
            try {
                Thread.sleep(1000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }

    private void connect(int roomId) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(baseUri.resolve("rooms/" + roomId + "/events"))
                .header("Accept", "text/event-stream")
                .timeout(Duration.ofSeconds(70))
                .GET()
                .build();

        HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
        if (response.statusCode() >= 400) {
            throw new IOException("HTTP " + response.statusCode());
        }

        try (InputStream stream = response.body();
             BufferedReader reader = new BufferedReader(new InputStreamReader(stream))) {
            String line;
            StringBuilder dataBuffer = new StringBuilder();
            while (!stopped && (line = reader.readLine()) != null) {
                if (line.startsWith("data:")) {
                    dataBuffer.append(line.substring(5).trim());
                } else if (line.isEmpty()) {
                    if (dataBuffer.length() > 0) {
                        handleData(roomId, dataBuffer.toString());
                        dataBuffer.setLength(0);
                    }
                }
            }
        }
    }

    private void handleData(int roomId, String data) {
        try {
            JsonNode node = objectMapper.readTree(data);
            JsonNode roomNode = node.path("room");
            RoomState room = RoomMapper.mapRoom(roomNode);
            eventBus.publish(new RoomRealtimeEvent(room, node));
        } catch (Exception e) {
            LOGGER.debug("Impossible de parser SSE room {} : {}", roomId, e.getMessage());
            eventBus.publish(new RoomRealtimeFailed(roomId, "parse error"));
        }
    }

    @Override
    public void close() {
        stop();
    }

    private static String clean(String message) {
        if (message == null) return "erreur";
        return message.replaceAll("\\s+", " ").trim();
    }
}
