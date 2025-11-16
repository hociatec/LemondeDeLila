package com.lemondelila.client.gamelogic.damenature.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public record DameNatureStateDto(
        String type,
        String status,
        int turnIndex,
        int round,
        int pollution,
        MetadataDto metadata,
        DeckDto deck,
        List<PlayerDto> players,
        PendingQuizDto pendingQuiz,
        List<LogEntryDto> log,
        CatalogDto catalog,
        Map<String, CardDefinitionDto> cards
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record MetadataDto(int maxPollution) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DeckDto(int remaining) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PlayerDto(
            int id,
            String username,
            int handCount,
            List<HandCardDto> hand,
            List<String> books,
            boolean isBot
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record HandCardDto(
            String code,
            String type,
            String familyId,
            String familyName,
            String memberId,
            String memberName,
            String role
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PendingQuizDto(String question, List<String> choices) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record LogEntryDto(String message, String type) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CatalogDto(List<FamilyDto> families, List<DangerCardDto> dangerCards) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record FamilyDto(String id, String name, List<FamilyMemberDto> members) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record FamilyMemberDto(String id, String name, String role) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DangerCardDto(String id, String name, int pollutionDelta) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CardDefinitionDto(
            String type,
            String familyId,
            String familyName,
            String memberId,
            String memberName,
            String role
    ) {
    }
}
