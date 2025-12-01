package com.lemondelila.client.game.session.service;

import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.user.dto.LoginResponseDto;

import java.io.IOException;
import java.util.Map;

public final class SessionApiService {

    private final RestClient restClient;

    public SessionApiService(RestClient restClient) {
        this.restClient = restClient;
    }

    public LoginResponseDto login(String username, char[] password) throws IOException, InterruptedException {
        return restClient.post("login", Map.of(
                "username", username,
                "password", String.valueOf(password)
        ), LoginResponseDto.class);
    }

    public void logout() {
        // Backend does not require a logout endpoint for JWT; clearing local state is enough.
    }
}
