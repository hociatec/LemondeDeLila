package com.lemondelila.client.user.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public final class RegistrationResponseDto {

    private String username;

    public String username() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }
}
