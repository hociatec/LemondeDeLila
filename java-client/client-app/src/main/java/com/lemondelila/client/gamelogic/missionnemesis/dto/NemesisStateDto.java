package com.lemondelila.client.gamelogic.missionnemesis.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record NemesisStateDto(
        String type,
        int turnIndex,
        String status,
        Integer winner,
        int round,
        List<PlayerDto> players,
        List<LogEntryDto> log
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PlayerDto(
            int id,
            String username,
            List<ShipDto> ships,
            List<ShotDto> shots,
            String status,
            boolean isBot,
            boolean isSelf
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ShipDto(
            String name,
            List<CoordinateDto> coordinates,
            List<CoordinateDto> coords,
            List<Boolean> hits
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CoordinateDto(int x, int y) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ShotDto(
            int x,
            int y,
            int targetId,
            String result,
            Integer shipIndex,
            Boolean damage
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record LogEntryDto(
            String type,
            String message,
            Integer from,
            Integer fromPlayerId,
            Integer target,
            Integer targetPlayerId,
            Integer x,
            Integer y,
            String result
    ) {
    }
}
