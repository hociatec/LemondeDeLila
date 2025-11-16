package com.lemondelila.client.game.service.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record RoomBotCreateResponseDto(RoomBotDto bot) {
}
