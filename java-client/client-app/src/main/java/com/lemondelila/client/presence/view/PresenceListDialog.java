package com.lemondelila.client.presence.view;

import com.lemondelila.client.chat.model.ChatConnection;
import com.lemondelila.client.chat.model.ChatState;
import com.lemondelila.client.chat.service.ChatConnectionFactory;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.messaging.controller.MessagingController;
import com.lemondelila.client.messaging.service.UserRelationshipService;
import com.lemondelila.client.presence.model.PresencePlayer;

import javax.swing.AbstractAction;
import javax.swing.DefaultListModel;
import javax.swing.JDialog;
import javax.swing.JList;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.awt.Point;
import java.awt.Window;
import java.awt.event.ActionEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.List;

public final class PresenceListDialog extends JDialog {

    private final PresenceListView ui;
    private final ChatConnection connection;
    private final DialogService dialogService;
    private final MessagingController messagingController;
    private final UserRelationshipService relationshipService;
    private final PresencePlayerActionMenu playerActions;

    public PresenceListDialog(Window owner,
                              ChatConnectionFactory connectionFactory,
                              DialogService dialogService,
                              MessagingController messagingController,
                              UserRelationshipService relationshipService) {
        super(owner, "Joueurs connectés", ModalityType.APPLICATION_MODAL);
        this.dialogService = dialogService;
        this.messagingController = messagingController;
        this.relationshipService = relationshipService;
        this.ui = new PresenceListView(this::dispose);
        this.playerActions = new PresencePlayerActionMenu(
                ui.list(),
                this::openConversation,
                this::toggleFriend,
                this::toggleBlock,
                relationshipService);

        setLayout(new BorderLayout(8, 8));
        setDefaultCloseOperation(DISPOSE_ON_CLOSE);
        add(ui.contentPanel(), BorderLayout.CENTER);
        add(ui.footerPanel(), BorderLayout.SOUTH);

        this.connection = connectionFactory.open();
        ui.setListEnabled(false);
        registerHandlers();
        connection.connect();
        List<PresencePlayer> latestPresence = connection.latestPresence();
        if (latestPresence != null && !latestPresence.isEmpty()) {
            updateList(latestPresence);
        } else {
            updateStatus("Recherche des joueurs connectés...");
        }

        configureListInteractions();

        addWindowListener(new java.awt.event.WindowAdapter() {
            @Override
            public void windowClosed(java.awt.event.WindowEvent e) {
                connection.close();
            }
        });

        setSize(420, 400);
        setLocationRelativeTo(owner);
    }

    private void registerHandlers() {
        connection.onPresence(players -> SwingUtilities.invokeLater(() -> updateList(players)));
        connection.onState(state -> {
            if (state == ChatState.FAILED) {
                SwingUtilities.invokeLater(() -> updateStatus("Erreur de connexion au serveur de présence."));
            }
        });
        connection.onError(error -> SwingUtilities.invokeLater(() -> dialogService.error("Présence", error)));
    }

    private void updateList(List<PresencePlayer> players) {
        DefaultListModel<PresencePlayer> model = ui.model();
        model.clear();
        if (players == null || players.isEmpty()) {
            updateStatus("Aucun joueur en ligne pour le moment.");
            ui.setListEnabled(false);
            return;
        }
        players.forEach(model::addElement);
        ui.setListEnabled(true);
        updateStatus(formatPlayerCount(players.size()));
        ui.list().setSelectedIndex(0);
    }

    private String formatPlayerCount(int size) {
        return size == 1 ? "1 joueur en ligne" : size + " joueurs en ligne";
    }

    private void configureListInteractions() {
        JList<PresencePlayer> playerList = ui.list();
        playerList.setCellRenderer(new PresencePlayerRenderer(relationshipService));
        playerList.getInputMap().put(KeyStroke.getKeyStroke("ENTER"), "presence.actions");
        playerList.getActionMap().put("presence.actions", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                showAccessibleActions();
            }
        });
        playerList.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                if (SwingUtilities.isRightMouseButton(e)) {
                    int index = playerList.locationToIndex(e.getPoint());
                    if (index >= 0) {
                        playerList.setSelectedIndex(index);
                        PresencePlayer player = playerList.getSelectedValue();
                        if (player != null) {
                            List<String> options = playerActions.showAt(player, playerList, e.getX(), e.getY());
                            updateStatusFromOptions(options);
                        }
                    }
                } else if (SwingUtilities.isLeftMouseButton(e) && e.getClickCount() == 2) {
                    int index = playerList.locationToIndex(e.getPoint());
                    if (index >= 0) {
                        playerList.setSelectedIndex(index);
                        showAccessibleActions();
                    }
                }
            }
        });
    }

    private void showActionsForSelection() {
        JList<PresencePlayer> playerList = ui.list();
        int index = playerList.getSelectedIndex();
        if (index < 0) {
            return;
        }
        Point location = playerList.indexToLocation(index);
        if (location == null) {
            location = new Point(0, 0);
        }
        PresencePlayer selected = playerList.getSelectedValue();
        if (selected == null) {
            updateStatus("Aucun joueur sélectionné.");
            return;
        }
        List<String> options = playerActions.showAt(selected, playerList, location.x + 16,
                location.y + playerList.getFixedCellHeight());
        updateStatusFromOptions(options);
    }

    private void updateStatus(String message) {
        ui.setStatus(message);
    }

    private void showAccessibleActions() {
        JList<PresencePlayer> playerList = ui.list();
        int index = playerList.getSelectedIndex();
        if (index < 0) {
            updateStatus("Sélectionnez un joueur pour afficher les options disponibles.");
            return;
        }
        PresencePlayer player = playerList.getSelectedValue();
        if (player == null) {
            updateStatus("Aucun joueur sélectionné.");
            return;
        }

        showActionsForSelection();
    }

    private void toggleFriend(PresencePlayer player) {
        if (player == null) {
            return;
        }
        relationshipService.toggleFriend(player.id(), player.username());
        updateStatus(relationshipService.isFriend(player.id())
                ? player.username() + " ajouté dans vos amis."
                : player.username() + " retiré de vos amis.");
        ui.list().repaint();
    }

    private void toggleBlock(PresencePlayer player) {
        if (player == null) {
            return;
        }
        relationshipService.toggleBlock(player.id(), player.username());
        boolean blocked = relationshipService.isBlocked(player.id());
        updateStatus(blocked
                ? player.username() + " est bloqué."
                : player.username() + " est débloqué.");
        ui.list().repaint();
    }

    private void openConversation(PresencePlayer player) {
        if (player == null) {
            return;
        }
        messagingController.openConversation(this, player);
    }

    private void updateStatusFromOptions(List<String> options) {
        if (options.isEmpty()) {
            updateStatus("Aucune action disponible pour ce joueur.");
        } else if (options.size() == 1) {
            updateStatus("Option disponible : " + options.get(0) + ".");
        } else {
            updateStatus("Actions disponibles affichées.");
        }
    }

}
