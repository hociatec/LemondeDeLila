package com.lemondelila.client.social.view;

import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.messaging.controller.MessagingController;
import com.lemondelila.client.messaging.service.MessagingService;
import com.lemondelila.client.messaging.service.UserRelationshipService;
import com.lemondelila.client.user.model.ClientSession;

import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JTabbedPane;
import javax.swing.border.EmptyBorder;
import java.awt.BorderLayout;
import java.awt.Window;
import java.util.Objects;

final class SocialCenterDialog extends JDialog {

    private final ClientSession session;

    private final JLabel globalStatus = new JLabel(" ");
    private final SocialRelationshipsPanel relationshipsPanel;
    private final SocialMessagesPanel messagesPanel;

    SocialCenterDialog(Window owner,
                       UserRelationshipService relationshipService,
                       MessagingService messagingService,
                       MessagingController messagingController,
                       DialogService dialogService,
                       ClientSession session) {
        super(owner, "Centre social", ModalityType.APPLICATION_MODAL);
        this.session = Objects.requireNonNull(session, "session");

        Objects.requireNonNull(relationshipService, "relationshipService");
        Objects.requireNonNull(messagingService, "messagingService");
        Objects.requireNonNull(messagingController, "messagingController");
        Objects.requireNonNull(dialogService, "dialogService");

        this.relationshipsPanel = new SocialRelationshipsPanel(
                owner,
                relationshipService,
                messagingController,
                this::updateGlobalStatus
        );
        this.messagesPanel = new SocialMessagesPanel(
                owner,
                messagingService,
                messagingController,
                dialogService,
                this::updateGlobalStatus
        );

        setDefaultCloseOperation(DISPOSE_ON_CLOSE);
        setLayout(new BorderLayout(8, 8));
        add(buildTabs(), BorderLayout.CENTER);
        globalStatus.setBorder(new EmptyBorder(4, 12, 8, 12));
        add(globalStatus, BorderLayout.SOUTH);

        setSize(780, 520);
        setLocationRelativeTo(owner);

        relationshipsPanel.reload();
        messagesPanel.reload();
        session.authenticated()
                .map(ClientSession.AuthState::username)
                .ifPresentOrElse(
                        name -> updateGlobalStatus("Connecté en tant que " + name + "."),
                        () -> updateGlobalStatus("Bienvenue dans le centre social.")
                );
    }

    private JTabbedPane buildTabs() {
        JTabbedPane tabs = new JTabbedPane();
        tabs.addTab("Amis & blocages", relationshipsPanel);
        tabs.addTab("Messagerie", messagesPanel);
        return tabs;
    }

    private void updateGlobalStatus(String message) {
        globalStatus.setText(message == null || message.isBlank() ? " " : message);
    }
}
