package com.lemondelila.client.game.room.browser.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.game.room.browser.event.JoinRoomFailed;
import com.lemondelila.client.game.room.browser.event.JoinRoomRequested;
import com.lemondelila.client.game.room.browser.event.JoinRoomSucceeded;
import com.lemondelila.client.game.room.browser.event.PublicRoomsFailed;
import com.lemondelila.client.game.room.browser.event.PublicRoomsLoaded;
import com.lemondelila.client.game.room.browser.event.PublicRoomsRequested;
import com.lemondelila.client.game.room.browser.model.PublicRoomSummary;
import com.lemondelila.client.game.room.browser.service.RoomDirectoryService;
import com.lemondelila.client.game.room.model.RoomDetailsState;
import com.lemondelila.client.game.room.model.PendingRoomInvites;
import com.lemondelila.client.game.room.view.RoomTableScreen;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.user.model.ClientSession;

import java.util.List;
import java.util.Objects;

public final class RoomBrowserController implements AutoCloseable {

    private final DomainEventBus eventBus;
    private final TaskScheduler scheduler;
    private final RoomDirectoryService service;
    private final RoomDetailsState detailsState;
    private final ClientSession session;
    private final PendingRoomInvites inviteStore;
    private final EventSubscriptions subscriptions = new EventSubscriptions();

    @Inject
    public RoomBrowserController(DomainEventBus eventBus,
                                 TaskScheduler scheduler,
                                 RoomDirectoryService service,
                                 RoomDetailsState detailsState,
                                 ClientSession session,
                                 PendingRoomInvites inviteStore) {
        this.eventBus = Objects.requireNonNull(eventBus, "eventBus");
        this.scheduler = Objects.requireNonNull(scheduler, "scheduler");
        this.service = Objects.requireNonNull(service, "service");
        this.detailsState = Objects.requireNonNull(detailsState, "detailsState");
        this.session = Objects.requireNonNull(session, "session");
        this.inviteStore = Objects.requireNonNull(inviteStore, "inviteStore");

        subscriptions.subscribe(eventBus, PublicRoomsRequested.class, ev -> fetchPublic(ev.gameType()));
        subscriptions.subscribe(eventBus, JoinRoomRequested.class, ev -> join(ev.roomId()));
    }

    public ControllerResult openBrowser() {
        return ControllerResult.navigate(com.lemondelila.client.game.room.browser.view.RoomBrowserScreen.ID);
    }

    private void fetchPublic(String gameType) {
        scheduler.runAsync(() -> {
            try {
                List<PublicRoomSummary> rooms = service.listPublicRooms(gameType);
                eventBus.publish(new PublicRoomsLoaded(rooms));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                eventBus.publish(new PublicRoomsFailed("Chargement interrompu"));
            } catch (Exception e) {
                eventBus.publish(new PublicRoomsFailed(clean(e.getMessage())));
            }
        });
    }

    private void join(int roomId) {
        scheduler.runAsync(() -> {
            try {
                var joined = service.joinPublicRoom(roomId);
                detailsState.setRoomId(joined.roomId());
                detailsState.setGameType(joined.gameType());
                detailsState.setRoomName(joined.roomName());
                eventBus.publish(new JoinRoomSucceeded(joined.roomId(), joined.gameType()));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                eventBus.publish(new JoinRoomFailed("Join interrompu"));
            } catch (Exception e) {
                eventBus.publish(new JoinRoomFailed(clean(e.getMessage())));
            }
        });
    }

    public ControllerResult acceptInviteAndOpenTable(String invitationId) {
        if (invitationId == null || invitationId.isBlank()) {
            return ControllerResult.status("Invitation invalide");
        }
        if (session.authenticated().isEmpty()) {
            return ControllerResult.status("Authentification requise");
        }
        try {
            var joined = service.respondInvite(invitationId, true);
            if (joined == null) {
                return ControllerResult.status("Invitation refusée ou expirée");
            }
            inviteStore.remove(invitationId);
            detailsState.setRoomId(joined.roomId());
            detailsState.setGameType(joined.gameType());
            detailsState.setRoomName(joined.roomName());
            return ControllerResult.navigate(RoomTableScreen.ID);
        } catch (Exception e) {
            return ControllerResult.status("Impossible d'accepter l'invitation : " + clean(e.getMessage()));
        }
    }

    public void refuseInvite(String invitationId) {
        if (invitationId == null || invitationId.isBlank()) {
            return;
        }
        inviteStore.remove(invitationId);
        scheduler.runAsync(() -> {
            try {
                service.respondInvite(invitationId, false);
            } catch (Exception ignored) {
            }
        });
    }

    @Override
    public void close() {
        subscriptions.close();
    }

    private static String clean(String message) {
        if (message == null) return "erreur";
        return message.replaceAll("\\s+", " ").trim();
    }
}
