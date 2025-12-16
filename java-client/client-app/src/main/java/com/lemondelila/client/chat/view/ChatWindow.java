package com.lemondelila.client.chat.view;

import com.lemondelila.client.chat.model.ChatMessage;
import com.lemondelila.client.chat.model.ChatState;
import com.lemondelila.client.chat.presenter.ChatPresenter;
import com.lemondelila.client.chat.presenter.ChatView;
import com.lemondelila.client.presence.model.PresencePlayer;
import com.lemondelila.client.presence.model.PresenceStatusFormatter;
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

public final class ChatWindow extends JDialog implements ChatView {

    private static final ZoneId LOCAL_ZONE = ZoneId.systemDefault();
    private static final DateTimeFormatter TIME_FORMATTER =
            DateTimeFormatter.ofPattern("HH:mm");

    private final JTextArea historyArea = new JTextArea();
    private final JTextField inputField = new JTextField();
    private final DefaultListModel<String> presenceModel = new DefaultListModel<>();
    private final JList<String> presenceList = new JList<>(presenceModel);

    private final ChatPresenter presenter;
    private final AppSettingsService settingsService;
    private final DialogService dialogService;
    private final Runnable onDisposeCallback;

    public ChatWindow(Window owner,
                      ChatPresenter presenter,
                      AppSettingsService settingsService,
                      DialogService dialogService,
                      Runnable onDisposeCallback) {
        super(owner, "Tchat", ModalityType.MODELESS);
        this.presenter = presenter;
        this.settingsService = settingsService;
        this.dialogService = dialogService;
        this.onDisposeCallback = onDisposeCallback == null ? () -> { } : onDisposeCallback;
        setDefaultCloseOperation(DO_NOTHING_ON_CLOSE);
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

        presenter.attach(this);
        presenter.start();
        updatePresence(List.of());

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
                dispose();
            }
        });

        pack();
        setLocationRelativeTo(owner);
    }

    @Override
    public void showHistory(List<ChatMessage> messages) {
        invokeOnEdt(() -> renderHistory(messages));
    }

    @Override
    public void appendMessage(ChatMessage message) {
        invokeOnEdt(() -> appendMessageInternal(message));
    }

    @Override
    public void showStatus(ChatState state) {
        invokeOnEdt(() -> appendStatus(state));
    }

    @Override
    public void showError(String message) {
        invokeOnEdt(() -> dialogService.error("Tchat", message));
    }

    @Override
    public void updatePresence(List<PresencePlayer> players) {
        invokeOnEdt(() -> updatePresenceListInternal(players));
    }

    private void renderHistory(List<ChatMessage> messages) {
        historyArea.setText("");
        messages.forEach(this::appendMessageInternal);
        appendBlankLine();
    }

    private void appendMessageInternal(ChatMessage message) {
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
        presenter.sendMessage(text);
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

    private void updatePresenceListInternal(List<PresencePlayer> players) {
        presenceModel.clear();
        if (players.isEmpty()) {
            presenceModel.addElement("Aucun joueur en ligne");
            presenceList.clearSelection();
            return;
        }
        players.forEach(player -> presenceModel.addElement(
                player.username() + " - " + PresenceStatusFormatter.describe(player)
        ));
        presenceList.setSelectedIndex(0);
    }

    @Override
    public void dispose() {
        presenter.close();
        presenter.detach();
        super.dispose();
        onDisposeCallback.run();
    }

    private void invokeOnEdt(Runnable runnable) {
        if (SwingUtilities.isEventDispatchThread()) {
            runnable.run();
        } else {
            SwingUtilities.invokeLater(runnable);
        }
    }
}
