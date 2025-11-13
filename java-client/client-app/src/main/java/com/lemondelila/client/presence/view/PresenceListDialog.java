package com.lemondelila.client.presence.view;

import com.lemondelila.client.chat.model.ChatConnection;
import com.lemondelila.client.chat.service.ChatConnectionFactory;
import com.lemondelila.client.chat.model.ChatState;
import com.lemondelila.client.presence.model.PresenceChat;
import com.lemondelila.client.presence.model.PresencePlayer;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.util.ButtonUtils;

import javax.swing.DefaultListModel;
import javax.swing.JButton;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.SwingUtilities;
import javax.swing.border.EmptyBorder;
import java.awt.BorderLayout;
import java.awt.Window;
import java.util.List;
import java.util.stream.Collectors;

public final class PresenceListDialog extends JDialog {

    private final DefaultListModel<String> model = new DefaultListModel<>();
    private final JList<String> list = new JList<>(model);
    private final JLabel statusLabel = new JLabel("Connexion au serveur...");
    private final ChatConnection connection;
    private final DialogService dialogService;

    public PresenceListDialog(Window owner,
                              ChatConnectionFactory connectionFactory,
                              DialogService dialogService) {
        super(owner, "Joueurs connect\u00e9s", ModalityType.APPLICATION_MODAL);
        this.dialogService = dialogService;
        setLayout(new BorderLayout(8, 8));
        setDefaultCloseOperation(DISPOSE_ON_CLOSE);

        JPanel content = new JPanel(new BorderLayout(8, 8));
        content.setBorder(new EmptyBorder(12, 12, 12, 12));
        content.add(new JLabel("Liste des joueurs connect\u00e9s"), BorderLayout.NORTH);
        content.add(new JScrollPane(list), BorderLayout.CENTER);
        content.add(statusLabel, BorderLayout.SOUTH);
        add(content, BorderLayout.CENTER);

        JButton closeButton = new JButton("Fermer");
        closeButton.addActionListener(e -> dispose());
        ButtonUtils.enterActivates(closeButton);
        JPanel footer = new JPanel();
        footer.add(closeButton);
        add(footer, BorderLayout.SOUTH);

        this.connection = connectionFactory.open();
        registerHandlers();
        connection.connect();
        updateList(connection.latestPresence());

        addWindowListener(new java.awt.event.WindowAdapter() {
            @Override
            public void windowClosed(java.awt.event.WindowEvent e) {
                connection.close();
            }
        });

        setSize(400, 380);
        setLocationRelativeTo(owner);
    }

    private void registerHandlers() {
        connection.onPresence(players -> SwingUtilities.invokeLater(() -> updateList(players)));
        connection.onState(state -> {
            if (state == ChatState.FAILED) {
                SwingUtilities.invokeLater(() -> statusLabel.setText("Erreur de connexion au serveur de pr\u00e9sence."));
            }
        });
        connection.onError(error -> SwingUtilities.invokeLater(() -> dialogService.error("Pr\u00e9sence", error)));
    }

    private void updateList(List<PresencePlayer> players) {
        model.clear();
        if (players.isEmpty()) {
            model.addElement("Aucun joueur en ligne");
            statusLabel.setText("0 joueur en ligne");
            list.clearSelection();
            return;
        }
        players.forEach(player -> {
            String rooms = player.rooms().isEmpty()
                    ? ""
                    : " [" + player.rooms().stream().map(PresenceChat::name).collect(Collectors.joining(", ")) + "]";
            model.addElement(player.username() + rooms);
        });
        statusLabel.setText(players.size() + " joueur(s) en ligne");
        list.setSelectedIndex(0);
    }
}


