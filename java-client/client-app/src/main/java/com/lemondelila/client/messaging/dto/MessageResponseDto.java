package com.lemondelila.client.messaging.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public final class MessageResponseDto {

    private MessageDto message;

    public MessageDto message() {
        return message;
    }

    public void setMessage(MessageDto message) {
        this.message = message;
    }
}
