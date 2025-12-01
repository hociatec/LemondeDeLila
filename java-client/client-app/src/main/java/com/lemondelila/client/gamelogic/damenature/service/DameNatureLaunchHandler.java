package com.lemondelila.client.gamelogic.damenature.service;

import com.lemondelila.client.game.room.service.GameLaunchCoordinator;
import com.lemondelila.client.game.room.service.GameLaunchHandler;
import com.lemondelila.client.game.room.service.RoomRealtimeService;
import com.lemondelila.client.gamelogic.damenature.DameNatureGameModule;
import com.lemondelila.client.framework.core.di.Inject;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

public final class DameNatureLaunchHandler implements GameLaunchHandler {

    private final RoomRealtimeService realtimeService;
    private final DameNatureConfigState configState;

    @Inject
    public DameNatureLaunchHandler(GameLaunchCoordinator coordinator,
                                   RoomRealtimeService realtimeService,
                                   DameNatureConfigState configState) {
        this.realtimeService = Objects.requireNonNull(realtimeService, "realtimeService");
        this.configState = Objects.requireNonNull(configState, "configState");
        Objects.requireNonNull(coordinator, "coordinator").register(this);
    }

    @Override
    public String gameType() {
        return DameNatureGameModule.GAME_TYPE;
    }

    @Override
    public void launch(int roomId) {
        if (roomId <= 0) {
            return;
        }
        Map<String, Object> payload = new HashMap<>();
        payload.put("roomId", roomId);
        payload.put("options", configState.toOptionsPayload());
        realtimeService.sendCommand("room.start", payload);
    }
}
