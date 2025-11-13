package com.lemondelila.client.gamelogic.missionnemesis.service;

import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisEngine;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSession;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisState;
import com.lemondelila.client.user.model.ClientSession;

import java.util.List;
import java.util.Objects;

final class NemesisSessionMapper {

    private final NemesisEngine engine;
    private final ClientSession clientSession;

    NemesisSessionMapper(NemesisEngine engine, ClientSession clientSession) {
        this.engine = Objects.requireNonNull(engine, "engine");
        this.clientSession = Objects.requireNonNull(clientSession, "clientSession");
    }

    NemesisSession map(int roomId, NemesisState state) {
        String username = clientSession.authenticated()
                .map(ClientSession.AuthState::username)
                .orElse(null);
        NemesisState.Player self = null;
        int selfIndex = -1;
        List<NemesisState.Player> players = state.players();
        if (username != null) {
            for (int i = 0; i < players.size(); i++) {
                NemesisState.Player player = players.get(i);
                if (username.equalsIgnoreCase(player.username())) {
                    self = player;
                    selfIndex = i;
                    break;
                }
            }
        }
        return new NemesisSession(roomId, state, self, selfIndex, engine.score(state));
    }
}
