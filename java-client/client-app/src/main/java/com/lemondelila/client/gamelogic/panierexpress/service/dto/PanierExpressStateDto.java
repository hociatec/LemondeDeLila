package com.lemondelila.client.gamelogic.panierexpress.service.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PanierExpressStateDto(
        String status,
        String phase,
        int round,
        int turnIndex,
        Integer lastRoll,
        Integer winner,
        List<PlayerDto> players,
        PendingDto pending,
        List<LogEntryDto> log
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PlayerDto(
            int id,
            String username,
            int position,
            List<String> shoppingList,
            List<String> basket,
            List<String> inventory,
            boolean readyForCheckout,
            int skipTurns,
            boolean isBot
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PendingDto(
            String type,
            int playerId,
            String question,
            List<String> choices
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record LogEntryDto(String type, String message) {
    }
}
