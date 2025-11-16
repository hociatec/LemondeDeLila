package com.lemondelila.client.messaging.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public final class MessagesResponseDto {

    private List<MessageDto> items;

    public List<MessageDto> items() {
        return items;
    }

    public void setItems(List<MessageDto> items) {
        this.items = items;
    }
}
