package com.lemondelila.client.game.service.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record RoomDetailsDto(List<RoomBotDto> bots) {
}
