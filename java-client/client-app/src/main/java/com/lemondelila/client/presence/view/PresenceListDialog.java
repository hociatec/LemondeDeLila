package com.lemondelila.client.presence.view;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.game.room.browser.service.RoomDirectoryService;
import com.lemondelila.client.game.room.model.RoomDetailsState;
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.messaging.controller.MessagingController;
import com.lemondelila.client.messaging.service.UserRelationshipService;
import com.lemondelila.client.presence.controller.PresenceListController;
import com.lemondelila.client.presence.service.PresenceRealtimeService;
import com.lemondelila.client.user.model.ClientSession;
import com.lemondelila.client.game.room.model.PendingRoomInvites;

import javax.swing.JComponent;
import javax.swing.JDialog;
import javax.swing.KeyStroke;
import java.awt.BorderLayout;
import java.awt.event.KeyEvent;
import java.awt.Window;
import java.util.Objects;

/**
 * Fenêtre principale affichant les joueurs connectés.
 * Cette classe se limite à l'orchestration de la vue et du contrôleur.
 */
public final class PresenceListDialog extends JDialog {

    private final PresenceListController controller;
    private final PresenceListView view;

    public PresenceListDialog(Window owner,
                              DialogService dialogService,
                              MessagingController messagingController,
                              UserRelationshipService relationshipService,
                              PresenceRealtimeService realtimeService,
                              RoomDirectoryService roomDirectoryService,
                              RoomDetailsState roomDetailsState,
                              TableState tableState,
                              ClientSession session,
                              PendingRoomInvites inviteStore,
                              ObjectMapper mapper) {
        super(owner, "Joueurs connectés", ModalityType.MODELESS);

        Objects.requireNonNull(dialogService, "dialogService");
        Objects.requireNonNull(messagingController, "messagingController");
        Objects.requireNonNull(relationshipService, "relationshipService");
        Objects.requireNonNull(realtimeService, "realtimeService");
        Objects.requireNonNull(roomDirectoryService, "roomDirectoryService");
        Objects.requireNonNull(roomDetailsState, "roomDetailsState");
        Objects.requireNonNull(tableState, "tableState");
        Objects.requireNonNull(session, "session");
        Objects.requireNonNull(inviteStore, "inviteStore");
        Objects.requireNonNull(mapper, "mapper");

        this.view = new PresenceListView();
        this.controller = new PresenceListController(
                owner,
                dialogService,
                messagingController,
                relationshipService,
                realtimeService,
                view,
                roomDirectoryService,
                roomDetailsState,
                tableState,
                session,
                inviteStore,
                mapper,
                this::dispose
        );

        setLayout(new BorderLayout(8, 8));
        setDefaultCloseOperation(DISPOSE_ON_CLOSE);
        add(view.contentPanel(), BorderLayout.CENTER);
        getRootPane().registerKeyboardAction(
                e -> dispose(),
                KeyStroke.getKeyStroke(KeyEvent.VK_ESCAPE, 0),
                JComponent.WHEN_IN_FOCUSED_WINDOW
        );

        addWindowListener(new java.awt.event.WindowAdapter() {
            @Override
            public void windowOpened(java.awt.event.WindowEvent e) {
                controller.start();
            }

            @Override
            public void windowClosed(java.awt.event.WindowEvent e) {
                controller.stop();
            }
        });

        setSize(420, 400);
        setLocationRelativeTo(owner);
    }
}
