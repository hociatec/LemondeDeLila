package com.lemondelila.client.gamelogic.damenature.model;

import com.lemondelila.client.gamelogic.damenature.dto.DameNatureStateDto;
import com.lemondelila.client.gamelogic.damenature.dto.DameNatureStateDto.CatalogDto;
import com.lemondelila.client.gamelogic.damenature.dto.DameNatureStateDto.CardDefinitionDto;
import com.lemondelila.client.gamelogic.damenature.dto.DameNatureStateDto.DangerCardDto;
import com.lemondelila.client.gamelogic.damenature.dto.DameNatureStateDto.DeckDto;
import com.lemondelila.client.gamelogic.damenature.dto.DameNatureStateDto.FamilyDto;
import com.lemondelila.client.gamelogic.damenature.dto.DameNatureStateDto.FamilyMemberDto;
import com.lemondelila.client.gamelogic.damenature.dto.DameNatureStateDto.HandCardDto;
import com.lemondelila.client.gamelogic.damenature.dto.DameNatureStateDto.LogEntryDto;
import com.lemondelila.client.gamelogic.damenature.dto.DameNatureStateDto.MetadataDto;
import com.lemondelila.client.gamelogic.damenature.dto.DameNatureStateDto.PendingQuizDto;
import com.lemondelila.client.gamelogic.damenature.dto.DameNatureStateDto.PlayerDto;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class DameNatureStateMapper {

    private DameNatureStateMapper() {
    }

    public static DameNatureState fromDto(DameNatureStateDto dto) throws IOException {
        if (dto == null) {
            throw new IOException("Etat Dame Nature invalide");
        }

        String type = defaultString(dto.type(), "dame-nature");
        String status = defaultString(dto.status(), "playing");
        int turnIndex = dto.turnIndex();
        int round = dto.round();
        int pollution = dto.pollution();
        int maxPollution = extractMaxPollution(dto.metadata());

        DameNatureState.Deck deck = new DameNatureState.Deck(extractRemaining(dto.deck()));
        List<DameNatureState.Player> players = mapPlayers(dto.players());
        DameNatureState.PendingQuiz pendingQuiz = mapQuiz(dto.pendingQuiz());
        List<DameNatureState.LogEntry> logEntries = mapLog(dto.log());
        DameNatureState.Catalog catalog = mapCatalog(dto.catalog());
        Map<String, DameNatureState.CardDefinition> cards = mapCards(dto.cards());

        return new DameNatureState(
                type,
                status,
                turnIndex,
                round,
                pollution,
                maxPollution,
                deck,
                players,
                pendingQuiz,
                logEntries,
                catalog,
                cards
        );
    }

    private static int extractMaxPollution(MetadataDto metadata) {
        return metadata == null ? 12 : Math.max(0, metadata.maxPollution());
    }

    private static int extractRemaining(DeckDto deck) {
        return deck == null ? 0 : Math.max(0, deck.remaining());
    }

    private static List<DameNatureState.Player> mapPlayers(List<PlayerDto> dtos) {
        if (dtos == null || dtos.isEmpty()) {
            return List.of();
        }
        List<DameNatureState.Player> players = new ArrayList<>(dtos.size());
        for (PlayerDto dto : dtos) {
            if (dto == null) {
                continue;
            }
            int id = dto.id();
            String username = defaultString(dto.username(), "?");
            List<DameNatureState.HandCard> hand = mapHand(dto.hand());
            int handCount = dto.handCount() > 0 ? dto.handCount() : hand.size();
            List<String> books = dto.books() == null ? List.of() : List.copyOf(dto.books());
            players.add(new DameNatureState.Player(id, username, handCount, hand, books, dto.isBot()));
        }
        return List.copyOf(players);
    }

    private static List<DameNatureState.HandCard> mapHand(List<HandCardDto> cards) {
        if (cards == null || cards.isEmpty()) {
            return List.of();
        }
        List<DameNatureState.HandCard> hand = new ArrayList<>(cards.size());
        for (HandCardDto card : cards) {
            if (card == null) {
                continue;
            }
            hand.add(new DameNatureState.HandCard(
                    card.code(),
                    card.type(),
                    nullIfBlank(card.familyId()),
                    nullIfBlank(card.familyName()),
                    nullIfBlank(card.memberName()),
                    nullIfBlank(card.role())
            ));
        }
        return List.copyOf(hand);
    }

    private static DameNatureState.PendingQuiz mapQuiz(PendingQuizDto quiz) {
        if (quiz == null || quiz.question() == null || quiz.question().isBlank()) {
            return null;
        }
        List<String> choices = quiz.choices() == null ? List.of() : List.copyOf(quiz.choices());
        return new DameNatureState.PendingQuiz(quiz.question(), choices);
    }

    private static List<DameNatureState.LogEntry> mapLog(List<LogEntryDto> entries) {
        if (entries == null || entries.isEmpty()) {
            return List.of();
        }
        List<DameNatureState.LogEntry> logEntries = new ArrayList<>(entries.size());
        for (LogEntryDto entry : entries) {
            if (entry == null) {
                continue;
            }
            logEntries.add(new DameNatureState.LogEntry(
                    defaultString(entry.message(), ""),
                    defaultString(entry.type(), "info")
            ));
        }
        return List.copyOf(logEntries);
    }

    private static DameNatureState.Catalog mapCatalog(CatalogDto dto) {
        if (dto == null) {
            return new DameNatureState.Catalog(List.of(), List.of());
        }
        List<DameNatureState.Family> families = mapFamilies(dto.families());
        List<DameNatureState.DangerCard> dangerCards = mapDangerCards(dto.dangerCards());
        return new DameNatureState.Catalog(families, dangerCards);
    }

    private static List<DameNatureState.Family> mapFamilies(List<FamilyDto> families) {
        if (families == null || families.isEmpty()) {
            return List.of();
        }
        List<DameNatureState.Family> mapped = new ArrayList<>(families.size());
        for (FamilyDto family : families) {
            if (family == null) {
                continue;
            }
            List<DameNatureState.FamilyMember> members = mapMembers(family.members());
            mapped.add(new DameNatureState.Family(
                    family.id(),
                    defaultString(family.name(), family.id()),
                    members
            ));
        }
        return List.copyOf(mapped);
    }

    private static List<DameNatureState.FamilyMember> mapMembers(List<FamilyMemberDto> members) {
        if (members == null || members.isEmpty()) {
            return List.of();
        }
        List<DameNatureState.FamilyMember> mapped = new ArrayList<>(members.size());
        for (FamilyMemberDto member : members) {
            if (member == null) {
                continue;
            }
            mapped.add(new DameNatureState.FamilyMember(
                    member.id(),
                    member.name(),
                    member.role()
            ));
        }
        return List.copyOf(mapped);
    }

    private static List<DameNatureState.DangerCard> mapDangerCards(List<DangerCardDto> cards) {
        if (cards == null || cards.isEmpty()) {
            return List.of();
        }
        List<DameNatureState.DangerCard> mapped = new ArrayList<>(cards.size());
        for (DangerCardDto card : cards) {
            if (card == null) {
                continue;
            }
            mapped.add(new DameNatureState.DangerCard(
                    card.id(),
                    card.name(),
                    card.pollutionDelta()
            ));
        }
        return List.copyOf(mapped);
    }

    private static Map<String, DameNatureState.CardDefinition> mapCards(Map<String, CardDefinitionDto> cards) {
        if (cards == null || cards.isEmpty()) {
            return Map.of();
        }
        Map<String, DameNatureState.CardDefinition> mapped = new HashMap<>();
        cards.forEach((code, definition) -> {
            if (definition == null) {
                return;
            }
            mapped.put(code, new DameNatureState.CardDefinition(
                    definition.type(),
                    definition.familyId(),
                    definition.familyName(),
                    definition.memberId(),
                    definition.memberName(),
                    definition.role()
            ));
        });
        return Map.copyOf(mapped);
    }

    private static String defaultString(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private static String nullIfBlank(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
