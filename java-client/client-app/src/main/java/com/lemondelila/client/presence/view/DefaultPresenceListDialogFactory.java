package com.lemondelila.client.presence.view;

import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.game.room.browser.service.RoomDirectoryService;
import com.lemondelila.client.game.room.model.RoomDetailsState;
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.game.room.model.PendingRoomInvites;
import com.lemondelila.client.messaging.controller.MessagingController;
import com.lemondelila.client.messaging.service.UserRelationshipService;
import com.lemondelila.client.presence.service.PresenceRealtimeService;
import com.lemondelila.client.user.model.ClientSession;

import javax.inject.Inject;
import java.awt.Window;
import java.util.Objects;

public final class DefaultPresenceListDialogFactory implements PresenceListDialogFactory {

    private final DialogService dialogService;
    private final MessagingController messagingController;
    private final UserRelationshipService relationshipService;
    private final PresenceRealtimeService realtimeService;
    private final RoomDirectoryService roomDirectoryService;
    private final RoomDetailsState roomDetailsState;
    private final TableState tableState;
    private final ClientSession session;
    private final PendingRoomInvites inviteStore;
    private final ObjectMapper mapper;

    @Inject
    public DefaultPresenceListDialogFactory(DialogService dialogService,
                                            MessagingController messagingController,
                                            UserRelationshipService relationshipService,
                                            PresenceRealtimeService realtimeService,
                                            RoomDirectoryService roomDirectoryService,
                                            RoomDetailsState roomDetailsState,
                                            TableState tableState,
                                            ClientSession session,
                                            PendingRoomInvites inviteStore,
                                            ObjectMapper mapper) {
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.messagingController = Objects.requireNonNull(messagingController, "messagingController");
        this.relationshipService = Objects.requireNonNull(relationshipService, "relationshipService");
        this.realtimeService = Objects.requireNonNull(realtimeService, "realtimeService");
        this.roomDirectoryService = Objects.requireNonNull(roomDirectoryService, "roomDirectoryService");
        this.roomDetailsState = Objects.requireNonNull(roomDetailsState, "roomDetailsState");
        this.tableState = Objects.requireNonNull(tableState, "tableState");
        this.session = Objects.requireNonNull(session, "session");
        this.inviteStore = Objects.requireNonNull(inviteStore, "inviteStore");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    @Override
    public PresenceListDialog create(Window owner, Runnable onClose) {
        PresenceListDialog dialog = new PresenceListDialog(
                owner,
                dialogService,
                messagingController,
                relationshipService,
                realtimeService,
                roomDirectoryService,
                roomDetailsState,
                tableState,
                session,
                inviteStore,
                mapper
        );
        dialog.addWindowListener(new java.awt.event.WindowAdapter() {
            @Override
            public void windowClosed(java.awt.event.WindowEvent e) {
                if (onClose != null) {
                    onClose.run();
                }
            }
        });
        return dialog;
    }
}
