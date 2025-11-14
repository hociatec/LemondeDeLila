package com.lemondelila.client.chat.view;

import com.lemondelila.client.chat.model.ChatConnection;
import com.lemondelila.client.chat.service.ChatConnectionFactory;
import com.lemondelila.client.chat.model.ChatMessage;
import com.lemondelila.client.chat.model.ChatState;
import com.lemondelila.client.presence.model.PresenceChat;
import com.lemondelila.client.presence.model.PresencePlayer;
import com.lemondelila.client.settings.service.AppSettingsService;
import com.lemondelila.client.framework.ui.dialog.DialogService;

import javax.swing.DefaultListModel;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JSplitPane;
import javax.swing.JTextArea;
import javax.swing.JTextField;
import javax.swing.SwingUtilities;
import javax.swing.border.EmptyBorder;
import javax.swing.text.DefaultEditorKit;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.Window;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

public final class ChatWindow extends JDialog {

    private static final ZoneId LOCAL_ZONE = ZoneId.systemDefault();
    private static final DateTimeFormatter TIME_FORMATTER =
            DateTimeFormatter.ofPattern("HH:mm");

    private final JTextArea historyArea = new JTextArea();
    private final JTextField inputField = new JTextField();
    private final DefaultListModel<String> presenceModel = new DefaultListModel<>();
    private final JList<String> presenceList = new JList<>(presenceModel);

    private final ChatConnection connection;
    private final AppSettingsService settingsService;
    private final DialogService dialogService;

    public ChatWindow(Window owner,
                      ChatConnectionFactory connectionFactory,
                      AppSettingsService settingsService,
                      DialogService dialogService) {
        super(owner, "Tchat", ModalityType.MODELESS);
        this.settingsService = settingsService;
        this.dialogService = dialogService;
        setDefaultCloseOperation(DISPOSE_ON_CLOSE);
        setLayout(new BorderLayout(8, 8));
        setPreferredSize(new Dimension(520, 440));

        historyArea.setEditable(false);
        historyArea.setLineWrap(true);
        historyArea.setWrapStyleWord(true);
        historyArea.setFont(historyArea.getFont().deriveFont(Font.PLAIN, 13f));
        historyArea.setBorder(new EmptyBorder(8, 8, 8, 8));
        JLabel historyLabel = new JLabel("Historique des messages");
        historyLabel.setLabelFor(historyArea);
        JPanel historyPanel = new JPanel(new BorderLayout());
        historyPanel.setBorder(new EmptyBorder(8, 8, 8, 8));
        historyPanel.add(historyLabel, BorderLayout.NORTH);
        historyPanel.add(new JScrollPane(historyArea), BorderLayout.CENTER);

        presenceList.setVisibleRowCount(12);
        JPanel presencePanel = new JPanel(new BorderLayout());
        presencePanel.setBorder(new EmptyBorder(8, 8, 8, 8));
        JLabel presenceLabel = new JLabel("Liste des joueurs connect\u00e9s");
        presenceLabel.setLabelFor(presenceList);
        presencePanel.add(presenceLabel, BorderLayout.NORTH);
        presencePanel.add(new JScrollPane(presenceList), BorderLayout.CENTER);

        JSplitPane splitPane = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT, historyPanel, presencePanel);
        splitPane.setResizeWeight(0.75);
        add(splitPane, BorderLayout.CENTER);

        JPanel composer = new JPanel(new BorderLayout(6, 6));
        composer.setBorder(new EmptyBorder(0, 8, 8, 8));
        JLabel inputLabel = new JLabel("Votre message");
        inputLabel.setLabelFor(inputField);
        composer.add(inputLabel, BorderLayout.NORTH);
        composer.add(inputField, BorderLayout.CENTER);
        add(composer, BorderLayout.SOUTH);

        this.connection = connectionFactory.open();
        registerHandlers();
        connection.connect();
        updatePresenceList(connection.latestPresence());

        inputField.addActionListener(e -> sendCurrentMessage());
        inputField.getInputMap().put(javax.swing.KeyStroke.getKeyStroke("shift ENTER"), "insert-break");
        inputField.getActionMap().put("insert-break", new DefaultEditorKit.InsertBreakAction());

        addWindowListener(new WindowAdapter() {
            @Override
            public void windowClosing(WindowEvent e) {
                if (settingsService.current().confirmChatExit()) {
                    int choice = JOptionPane.showConfirmDialog(
                            ChatWindow.this,
                            "Voulez-vous fermer le tchat ?",
                            "Fermer le tchat",
                            JOptionPane.YES_NO_OPTION,
                            JOptionPane.QUESTION_MESSAGE
                    );
                    if (choice != JOptionPane.YES_OPTION) {
                        return;
                    }
                }
                connection.close();
                dispose();
            }
        });

        pack();
        setLocationRelativeTo(owner);
    }

    private void registerHandlers() {
        connection.onHistory(messages -> SwingUtilities.invokeLater(() -> renderHistory(messages)));
        connection.onMessage(message -> SwingUtilities.invokeLater(() -> appendMessage(message)));
        connection.onState(state -> SwingUtilities.invokeLater(() -> appendStatus(state)));
        connection.onPresence(players -> SwingUtilities.invokeLater(() -> updatePresenceList(players)));
        connection.onError(error -> SwingUtilities.invokeLater(() -> dialogService.error("Tchat", error)));
    }

    private void renderHistory(List<ChatMessage> messages) {
        historyArea.setText("");
        messages.forEach(this::appendMessage);
        appendBlankLine();
    }

    private void appendMessage(ChatMessage message) {
        removeTrailingBlankLine();
        String timestamp = TIME_FORMATTER.format(message.createdAt().atZone(LOCAL_ZONE));
        historyArea.append(String.format("[%s] %s : %s%n", timestamp, message.username(), message.text()));
        appendBlankLine();
    }

    private void appendStatus(ChatState state) {
        removeTrailingBlankLine();
        historyArea.append(String.format("-- %s --%n", switch (state) {
            case CONNECTING -> "Connexion au serveur de tchat...";
            case CONNECTED -> "Connecté.";
            case CLOSED -> "Connexion fermée.";
            case FAILED -> "Erreur de connexion.";
        }));
        appendBlankLine();
    }

    private void sendCurrentMessage() {
        String text = inputField.getText().trim();
        if (text.isEmpty()) {
            return;
        }
        connection.sendMessage(text);
        inputField.setText("");
    }

    private void appendBlankLine() {
        String ln = System.lineSeparator();
        historyArea.append(ln);
        historyArea.setCaretPosition(historyArea.getDocument().getLength());
    }

    private void removeTrailingBlankLine() {
        String ln = System.lineSeparator();
        String doubleLn = ln + ln;
        String text = historyArea.getText();
        if (text.endsWith(doubleLn)) {
            historyArea.replaceRange("", text.length() - ln.length(), text.length());
        }
    }

    private void updatePresenceList(List<PresencePlayer> players) {
        presenceModel.clear();
        if (players.isEmpty()) {
            presenceModel.addElement("Aucun joueur en ligne");
            presenceList.clearSelection();
            return;
        }
        players.forEach(player -> {
            String rooms = player.rooms().isEmpty()
                    ? ""
                    : " [" + player.rooms().stream().map(PresenceChat::name).collect(Collectors.joining(", ")) + "]";
            presenceModel.addElement(player.username() + rooms);
        });
        presenceList.setSelectedIndex(0);
    }
}



