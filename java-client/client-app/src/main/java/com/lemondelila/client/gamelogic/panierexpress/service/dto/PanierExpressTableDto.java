package com.lemondelila.client.gamelogic.panierexpress.service.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PanierExpressTableDto(
        int id,
        String status,
        int maxPlayers,
        Integer ownerId,
        List<TablePlayerDto> players,
        List<TableBotDto> bots,
        Counts counts
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TablePlayerDto(int id, String username) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TableBotDto(int id, String name) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Counts(int players) {
    }
}

