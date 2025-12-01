package com.lemondelila.client.messaging.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public final class UserLookupResponseDto {

    private MessageUserDto user;

    public MessageUserDto user() {
        return user;
    }

    public void setUser(MessageUserDto user) {
        this.user = user;
    }
}
