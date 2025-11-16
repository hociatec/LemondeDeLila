package com.lemondelila.client.user.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public final class LoginResponseDto {

    private String token;

    public String token() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }
}
