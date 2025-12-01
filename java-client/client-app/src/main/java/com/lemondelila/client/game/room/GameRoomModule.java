package com.lemondelila.client.game.room;

import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.game.room.model.RoomDetailsState;
import com.lemondelila.client.game.room.model.RoomState;
import com.lemondelila.client.game.room.service.GameTableLauncher;
import com.lemondelila.client.game.room.service.RoomRealtimeService;
import com.lemondelila.client.game.room.view.RoomTableScreen;

@AutoService(LilaModule.class)
public final class GameRoomModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(RoomRealtimeService.class);
        builder.bindAuto(com.lemondelila.client.game.room.controller.RoomTableController.class);
        builder.bindAuto(RoomState.class);
        builder.bindAuto(RoomDetailsState.class);
        builder.bindAuto(GameTableLauncher.class);
        builder.bindAuto(com.lemondelila.client.game.room.model.TableState.class);
        builder.bindAuto(com.lemondelila.client.game.room.service.RoomLifecycleService.class);
        builder.bindAuto(com.lemondelila.client.game.room.service.GameLaunchCoordinator.class);
        builder.bindAuto(com.lemondelila.client.game.room.service.RoomStartService.class);
    }

    @Override
    public void start(ApplicationContext context) {
        // Warm services/controllers to subscribe immediately.
        context.get(com.lemondelila.client.game.room.service.RoomLifecycleService.class);
        context.get(com.lemondelila.client.game.room.service.RoomStartService.class);
    }

    @Override
    public int order() {
        // After session module (32) and network (30).
        return 42;
    }
}
