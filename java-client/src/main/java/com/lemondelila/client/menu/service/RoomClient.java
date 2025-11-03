package com.lemondelila.client.menu.service;

import com.lemondelila.client.menu.model.RoomSummary;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Client HTTP pour recuperer les salles/parties disponibles.
 */
public final class RoomClient {

    private static final Pattern ROOM_PATTERN = Pattern.compile(
            "\\{\\s*\\\"id\\\"\\s*:\\s*(?<id>[0-9]+).*?\\\"name\\\"\\s*:\\s*\\\"(?<name>[^\\\"]*)\\\".*?\\\"gameType\\\"\\s*:\\s*\\\"(?<game>[^\\\"]+)\\\".*?\\\"status\\\"\\s*:\\s*\\\"(?<status>[^\\\"]+)\\\".*?\\\"maxPlayers\\\"\\s*:\\s*(?<max>[0-9]+).*?\\\"counts\\\"\\s*:\\s*\\{[^}]*\\\"players\\\"\\s*:\\s*(?<players>[0-9]+).*?}.*?\\\"isPrivate\\\"\\s*:\\s*(?<private>true|false)",
            Pattern.DOTALL);

    private final HttpClient httpClient;
    private final URI roomsUri;

    public RoomClient(URI roomsUri) {
        this.roomsUri = Objects.requireNonNull(roomsUri, "roomsUri");
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public List<RoomSummary> fetchRooms(String token) throws IOException, InterruptedException {
        HttpRequest.Builder builder = HttpRequest.newBuilder(roomsUri)
                .timeout(Duration.ofSeconds(10))
                .header("Accept", "application/json");
        if (token != null && !token.isBlank()) {
            builder.header("Authorization", "Bearer " + token.trim());
        }
        HttpRequest request = builder.GET().build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() >= 200 && response.statusCode() < 300) {
            return parseRooms(response.body());
        }
        throw new IOException(String.format(Locale.ROOT, "Erreur HTTP %d lors de la recuperation des parties", response.statusCode()));
    }

    private static List<RoomSummary> parseRooms(String json) {
        List<RoomSummary> rooms = new ArrayList<>();
        if (json == null || json.isBlank()) {
            return rooms;
        }
        Matcher matcher = ROOM_PATTERN.matcher(json);
        while (matcher.find()) {
            rooms.add(new RoomSummary(
                    Integer.parseInt(matcher.group("id")),
                    matcher.group("name"),
                    matcher.group("game"),
                    matcher.group("status"),
                    Integer.parseInt(matcher.group("players")),
                    Integer.parseInt(matcher.group("max")),
                    Boolean.parseBoolean(matcher.group("private"))
            ));
        }
        return rooms;
    }
}
