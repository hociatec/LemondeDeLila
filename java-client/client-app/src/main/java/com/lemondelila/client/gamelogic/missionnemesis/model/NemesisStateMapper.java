package com.lemondelila.client.gamelogic.missionnemesis.model;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.gamelogic.missionnemesis.dto.NemesisStateDto;
import com.lemondelila.client.gamelogic.missionnemesis.dto.NemesisStateDto.LogEntryDto;
import com.lemondelila.client.gamelogic.missionnemesis.dto.NemesisStateDto.PlayerDto;
import com.lemondelila.client.gamelogic.missionnemesis.dto.NemesisStateDto.ShipDto;
import com.lemondelila.client.gamelogic.missionnemesis.dto.NemesisStateDto.ShotDto;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public final class NemesisStateMapper {

    private static final ObjectMapper TREE_MAPPER = new ObjectMapper();

    private NemesisStateMapper() {
    }

    public static NemesisState fromJson(JsonNode node) throws IOException {
        if (node == null || !node.isObject()) {
            throw new IOException("Etat Mission Nemesis invalide");
        }
        NemesisStateDto dto = TREE_MAPPER.treeToValue(node, NemesisStateDto.class);
        return fromDto(dto);
    }

    public static NemesisState fromDto(NemesisStateDto dto) throws IOException {
        if (dto == null) {
            throw new IOException("Etat Mission Nemesis invalide");
        }

        String type = dto.type() == null ? "mission-nemesis" : dto.type();
        String status = dto.status() == null ? "placement" : dto.status();
        int turnIndex = dto.turnIndex();
        int round = dto.round();

        List<NemesisState.Player> players = mapPlayers(dto.players());
        List<NemesisState.LogEntry> logEntries = mapLog(dto.log());

        return new NemesisState(
                type,
                players,
                turnIndex,
                status,
                dto.winner(),
                round,
                logEntries
        );
    }

    private static List<NemesisState.Player> mapPlayers(List<PlayerDto> dtos) {
        if (dtos == null || dtos.isEmpty()) {
            return List.of();
        }
        List<NemesisState.Player> players = new ArrayList<>(dtos.size());
        for (PlayerDto dto : dtos) {
            if (dto == null) {
                continue;
            }
            List<NemesisState.Ship> ships = mapShips(dto.ships());
            List<NemesisState.Shot> shots = mapShots(dto.shots());
            players.add(new NemesisState.Player(
                    dto.id(),
                    dto.username() == null ? "Inconnu" : dto.username(),
                    ships,
                    shots,
                    dto.status() == null ? "placing" : dto.status(),
                    dto.isBot(),
                    dto.isSelf()
            ));
        }
        return List.copyOf(players);
    }

    private static List<NemesisState.Ship> mapShips(List<ShipDto> dtos) {
        if (dtos == null || dtos.isEmpty()) {
            return List.of();
        }
        List<NemesisState.Ship> ships = new ArrayList<>(dtos.size());
        for (ShipDto dto : dtos) {
            if (dto == null) {
                continue;
            }
            List<NemesisState.Coordinate> coordinates = mapCoordinates(dto.coordinates(), dto.coords());
            boolean[] hits = mapHits(dto.hits(), coordinates.size());
            ships.add(new NemesisState.Ship(
                    dto.name() == null ? "Inconnu" : dto.name(),
                    coordinates,
                    hits
            ));
        }
        return List.copyOf(ships);
    }

    private static List<NemesisState.Coordinate> mapCoordinates(
            List<NemesisStateDto.CoordinateDto> coordinates,
            List<NemesisStateDto.CoordinateDto> fallback) {
        List<NemesisStateDto.CoordinateDto> nodes = coordinates != null && !coordinates.isEmpty()
                ? coordinates
                : fallback;
        if (nodes == null || nodes.isEmpty()) {
            return List.of();
        }
        List<NemesisState.Coordinate> mapped = new ArrayList<>(nodes.size());
        for (NemesisStateDto.CoordinateDto node : nodes) {
            if (node == null) {
                continue;
            }
            mapped.add(new NemesisState.Coordinate(node.x(), node.y()));
        }
        return List.copyOf(mapped);
    }

    private static boolean[] mapHits(List<Boolean> hits, int shipSize) {
        boolean[] resolved = new boolean[Math.max(shipSize, 0)];
        if (hits == null || hits.isEmpty()) {
            return resolved;
        }
        for (int i = 0; i < resolved.length && i < hits.size(); i++) {
            resolved[i] = Boolean.TRUE.equals(hits.get(i));
        }
        return resolved;
    }

    private static List<NemesisState.Shot> mapShots(List<ShotDto> dtos) {
        if (dtos == null || dtos.isEmpty()) {
            return List.of();
        }
        List<NemesisState.Shot> shots = new ArrayList<>(dtos.size());
        for (ShotDto dto : dtos) {
            if (dto == null) {
                continue;
            }
            shots.add(new NemesisState.Shot(
                    dto.x(),
                    dto.y(),
                    dto.targetId(),
                    dto.result() == null ? "miss" : dto.result(),
                    dto.shipIndex(),
                    dto.damage()
            ));
        }
        return List.copyOf(shots);
    }

    private static List<NemesisState.LogEntry> mapLog(List<LogEntryDto> entries) {
        if (entries == null || entries.isEmpty()) {
            return List.of();
        }
        List<NemesisState.LogEntry> logEntries = new ArrayList<>(entries.size());
        for (LogEntryDto entry : entries) {
            if (entry == null) {
                continue;
            }
            logEntries.add(new NemesisState.LogEntry(
                    entry.type(),
                    entry.message(),
                    firstNonNull(entry.from(), entry.fromPlayerId()),
                    firstNonNull(entry.target(), entry.targetPlayerId()),
                    entry.x(),
                    entry.y(),
                    entry.result()
            ));
        }
        return List.copyOf(logEntries);
    }

    private static Integer firstNonNull(Integer primary, Integer secondary) {
        return primary != null ? primary : secondary;
    }
}
