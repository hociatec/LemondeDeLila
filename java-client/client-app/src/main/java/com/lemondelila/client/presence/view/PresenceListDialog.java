package com.lemondelila.client.presence.view;

import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.messaging.controller.MessagingController;
import com.lemondelila.client.messaging.service.UserRelationshipService;
import com.lemondelila.client.presence.controller.PresenceListController;
import com.lemondelila.client.presence.service.PresenceRealtimeService;

import javax.swing.JDialog;
import java.awt.BorderLayout;
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
                              PresenceRealtimeService realtimeService) {
        super(owner, "Joueurs connectés", ModalityType.APPLICATION_MODAL);

        Objects.requireNonNull(dialogService, "dialogService");
        Objects.requireNonNull(messagingController, "messagingController");
        Objects.requireNonNull(relationshipService, "relationshipService");
        Objects.requireNonNull(realtimeService, "realtimeService");

        this.view = new PresenceListView(this::dispose);
        this.controller = new PresenceListController(
                owner,
                dialogService,
                messagingController,
                relationshipService,
                realtimeService,
                view
        );

        setLayout(new BorderLayout(8, 8));
        setDefaultCloseOperation(DISPOSE_ON_CLOSE);
        add(view.contentPanel(), BorderLayout.CENTER);
        add(view.footerPanel(), BorderLayout.SOUTH);

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
