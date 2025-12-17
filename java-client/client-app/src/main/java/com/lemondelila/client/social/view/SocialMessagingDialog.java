package com.lemondelila.client.social.view;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.messaging.controller.MessagingController;
import com.lemondelila.client.messaging.model.PrivateMessage;
import com.lemondelila.client.messaging.service.MessagingService;
import com.lemondelila.client.framework.access.AccessibilityPreferences;

import javax.swing.AbstractAction;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.DefaultListModel;
import javax.swing.JButton;
import javax.swing.JDialog;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.JTextField;
import javax.swing.KeyStroke;
import javax.swing.JLabel;
import javax.swing.ListCellRenderer;
import javax.swing.ListSelectionModel;
import javax.swing.SwingUtilities;
import javax.swing.event.ListSelectionListener;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Window;
import java.awt.event.ActionEvent;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

public final class SocialMessagingDialog extends JDialog {

    private static final ZoneId LOCAL_ZONE = ZoneId.systemDefault();
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("dd/MM HH:mm");

    private final MessagingService messagingService;
    private final MessagingController messagingController;
    private final DialogService dialogService;

    private final JList<MenuOption> menuList = new JList<>(MenuOption.values());
    private final DefaultListModel<PrivateMessage> messageModel = new DefaultListModel<>();
    private final JList<PrivateMessage> messageList = new JList<>(messageModel);

    private final JPanel cards = new JPanel(new java.awt.CardLayout());
    private final JPanel placeholderPanel = new JPanel();
    private final JPanel composePanel = new JPanel();
    private final JPanel listPanel = new JPanel(new BorderLayout(8, 8));

    private final JTextField usernameField = new JTextField(24);
    private final JButton lookupButton = new JButton(Internationalization.text("social.messaging.open"));
    private final JTextArea messageArea = new JTextArea(3, 32);
    private final JButton sendButton = new JButton(Internationalization.text("social.messaging.send"));
    private final JButton refreshButton = new JButton(Internationalization.text("social.messaging.refresh"));
    private final JButton openConversationButton = new JButton(Internationalization.text("social.messaging.open.conversation"));
    private final JLabel statusLabel = new JLabel(" ");

    private MenuOption currentOption;
    private boolean ignoreNextCloseRequest = false;

    public SocialMessagingDialog(Window owner,
                                 DialogService dialogService,
                                 MessagingService messagingService,
                                 MessagingController messagingController) {
        super(owner, Internationalization.text("social.messaging.title"), ModalityType.APPLICATION_MODAL);
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.messagingService = Objects.requireNonNull(messagingService, "messagingService");
        this.messagingController = Objects.requireNonNull(messagingController, "messagingController");
        setDefaultCloseOperation(DO_NOTHING_ON_CLOSE);
        installEscapeShortcut();
        addWindowListener(new WindowAdapter() {
            @Override
            public void windowClosing(WindowEvent e) {
                if (ignoreNextCloseRequest) {
                    ignoreNextCloseRequest = false;
                    return;
                }
                closeDialog();
            }
        });
        buildUi();
        showPlaceholder();
    }

    private void buildUi() {
        setLayout(new BorderLayout(12, 12));
        JPanel root = new JPanel(new BorderLayout(12, 12));
        root.setBorder(BorderFactory.createEmptyBorder(16, 16, 16, 16));
        add(root, BorderLayout.CENTER);

        root.add(buildMenuPanel(), BorderLayout.WEST);
        root.add(buildCards(), BorderLayout.CENTER);

        JPanel statusPanel = new JPanel(new BorderLayout());
        statusPanel.setBorder(BorderFactory.createEmptyBorder(0, 16, 8, 16));
        statusPanel.add(statusLabel, BorderLayout.CENTER);
        add(statusPanel, BorderLayout.SOUTH);

        setMinimumSize(new Dimension(640, 480));
        pack();
        SwingUtilities.invokeLater(() -> menuList.requestFocusInWindow());
    }

    private Component buildMenuPanel() {
        JPanel panel = new JPanel(new BorderLayout());
        menuList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        menuList.setVisibleRowCount(MenuOption.values().length);
        menuList.setFixedCellHeight(48);
        menuList.setCellRenderer(new MenuRenderer());
        suppressTab(menuList);
        menuList.getAccessibleContext().setAccessibleName(Internationalization.text("social.messaging.menu.accessible"));
        AccessibilityPreferences.applyDescription(menuList.getAccessibleContext(), Internationalization.text("social.messaging.menu.hint"));
        menuList.getInputMap().put(KeyStroke.getKeyStroke("ENTER"), "messaging.menu.activate");
        menuList.getActionMap().put("messaging.menu.activate", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                activateSelectedMenu();
            }
        });
        menuList.setSelectedValue(MenuOption.COMPOSE, true);
        panel.add(new JScrollPane(menuList), BorderLayout.CENTER);
        return panel;
    }

    private Component buildCards() {
        placeholderPanel.setLayout(new BorderLayout());
        JLabel hint = new JLabel(Internationalization.text("social.messaging.menu.hint"));
        hint.setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));
        placeholderPanel.add(hint, BorderLayout.CENTER);

        composePanel.setLayout(new BoxLayout(composePanel, BoxLayout.Y_AXIS));
        composePanel.setBorder(BorderFactory.createEmptyBorder(0, 0, 0, 0));

        JLabel description = new JLabel(Internationalization.text("social.messaging.prompt"));
        description.setAlignmentX(Component.LEFT_ALIGNMENT);
        composePanel.add(description);
        composePanel.add(Box.createVerticalStrut(8));

        usernameField.setMaximumSize(new Dimension(Integer.MAX_VALUE, usernameField.getPreferredSize().height));
        composePanel.add(usernameField);
        composePanel.add(Box.createVerticalStrut(8));

        lookupButton.setAlignmentX(Component.LEFT_ALIGNMENT);
        composePanel.add(lookupButton);
        composePanel.add(Box.createVerticalStrut(8));

        messageArea.setLineWrap(true);
        messageArea.setWrapStyleWord(true);
        messageArea.setMaximumSize(new Dimension(Integer.MAX_VALUE, 80));
        composePanel.add(new JScrollPane(messageArea));
        composePanel.add(Box.createVerticalStrut(8));

        sendButton.setAlignmentX(Component.LEFT_ALIGNMENT);
        composePanel.add(sendButton);

        suppressTab(usernameField);
        suppressTab(lookupButton);
        suppressTab(messageArea);
        suppressTab(sendButton);
        lookupButton.addActionListener(e -> startLookup());
        usernameField.addActionListener(e -> startLookup());
        messageArea.getInputMap().put(KeyStroke.getKeyStroke("control ENTER"), "messaging.compose.send");
        messageArea.getActionMap().put("messaging.compose.send", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                sendInitialMessage();
            }
        });
        sendButton.addActionListener(e -> sendInitialMessage());

        // List panel
        JPanel actionRow = new JPanel();
        actionRow.setLayout(new BoxLayout(actionRow, BoxLayout.X_AXIS));
        actionRow.add(refreshButton);
        actionRow.add(Box.createHorizontalStrut(8));
        actionRow.add(openConversationButton);
        actionRow.add(Box.createHorizontalGlue());
        listPanel.add(actionRow, BorderLayout.NORTH);

        messageList.setCellRenderer(new MessageRenderer());
        suppressTab(messageList);
        messageList.addListSelectionListener(listSelectionListener());
        messageList.addMouseListener(new java.awt.event.MouseAdapter() {
            @Override
            public void mouseClicked(java.awt.event.MouseEvent e) {
                if (e.getClickCount() == 2) {
                    openSelectedMessage();
                }
            }
        });
        listPanel.add(new JScrollPane(messageList), BorderLayout.CENTER);

        refreshButton.addActionListener(e -> {
            if (currentOption == null) {
                showPlaceholder();
            } else if (currentOption == MenuOption.COMPOSE) {
                showCompose();
            } else {
                showList();
                loadBox(currentOption);
            }
        });
        openConversationButton.addActionListener(e -> openSelectedMessage());

        cards.add(placeholderPanel, "PLACEHOLDER");
        cards.add(composePanel, MenuOption.COMPOSE.name());
        cards.add(listPanel, "LIST");
        return cards;
    }

    private void activateSelectedMenu() {
        MenuOption option = menuList.getSelectedValue();
        if (option == null) {
            return;
        }
        currentOption = option;
        if (option == MenuOption.COMPOSE) {
            showCompose();
        } else {
            showList();
            loadBox(option);
        }
    }

    private void showCompose() {
        ((java.awt.CardLayout) cards.getLayout()).show(cards, MenuOption.COMPOSE.name());
        setStatus(Internationalization.text("social.messaging.compose.hint"));
        SwingUtilities.invokeLater(() -> usernameField.requestFocusInWindow());
    }

    private void showList() {
        ((java.awt.CardLayout) cards.getLayout()).show(cards, "LIST");
    }

    private void showPlaceholder() {
        currentOption = null;
        ((java.awt.CardLayout) cards.getLayout()).show(cards, "PLACEHOLDER");
        setStatus(Internationalization.text("social.messaging.menu.hint"));
        SwingUtilities.invokeLater(() -> menuList.requestFocusInWindow());
    }

    private void startLookup() {
        String username = usernameField.getText();
        if (username == null || username.isBlank()) {
            setStatus(Internationalization.text("social.messaging.error.missing"));
            return;
        }
        setLookupEnabled(false);
        setStatus(Internationalization.text("social.messaging.status.lookup"));
        messagingService.lookupUser(username.trim())
                .whenComplete((knownUser, error) ->
                        SwingUtilities.invokeLater(() -> {
                            setLookupEnabled(true);
                            if (error != null || knownUser == null) {
                                dialogService.error(
                                        Internationalization.text("social.messaging.title"),
                                        error == null ? Internationalization.text("social.messaging.error.notfound") : error.getMessage());
                                setStatus(Internationalization.text("social.messaging.error.notfound"));
                                return;
                            }
                            messagingController.openConversation(getOwner(), knownUser.id(), knownUser.username());
                            }));
    }

    private void installEscapeShortcut() {
        getRootPane().registerKeyboardAction(
                e -> closeDialog(),
                KeyStroke.getKeyStroke("ESCAPE"),
                javax.swing.JComponent.WHEN_IN_FOCUSED_WINDOW
        );
        getRootPane().registerKeyboardAction(
                e -> {
                    ignoreNextCloseRequest = true;
                    setStatus(Internationalization.text("social.messaging.close.hint"));
                },
                KeyStroke.getKeyStroke("alt F4"),
                javax.swing.JComponent.WHEN_IN_FOCUSED_WINDOW
        );
    }

    private void closeDialog() {
        dispose();
    }

    private void sendInitialMessage() {
        String username = usernameField.getText();
        String text = messageArea.getText();
        if (username == null || username.isBlank()) {
            setStatus(Internationalization.text("social.messaging.error.missing"));
            usernameField.requestFocusInWindow();
            return;
        }
        if (text == null || text.isBlank()) {
            setStatus(Internationalization.text("social.messaging.error.empty"));
            messageArea.requestFocusInWindow();
            return;
        }
        setLookupEnabled(false);
        sendButton.setEnabled(false);
        setStatus(Internationalization.text("social.messaging.status.lookup"));
        messagingService.lookupUser(username.trim())
                .thenCompose(user -> messagingService.sendMessage(user.id(), text.trim()))
                .whenComplete((msg, error) ->
                        SwingUtilities.invokeLater(() -> {
                            setLookupEnabled(true);
                            sendButton.setEnabled(true);
                            if (error != null) {
                                dialogService.error(
                                        Internationalization.text("social.messaging.title"),
                                        error.getMessage() == null ? Internationalization.text("social.messaging.error.unknown") : error.getMessage());
                                setStatus(Internationalization.text("social.messaging.error.unknown"));
                                return;
                            }
                            setStatus(Internationalization.text("social.messaging.status.sent"));
                            messageArea.setText("");
                            messagingController.openConversation(getOwner(), msg.recipientId(), msg.recipientUsername());
                        }));
    }

    private void loadBox(MenuOption option) {
        messageModel.clear();
        setMenuEnabled(false);
        setStatus(Internationalization.text("social.messaging.status.loading"));
        CompletableFuture<List<PrivateMessage>> future = switch (option) {
            case INBOX -> messagingService.loadInbox(200);
            case OUTBOX -> messagingService.loadOutbox(200);
            case DELETED -> messagingService.loadDeleted(200);
            default -> CompletableFuture.completedFuture(List.of());
        };
        future.whenComplete((messages, error) ->
                SwingUtilities.invokeLater(() -> {
                    setMenuEnabled(true);
                    if (error != null) {
                        String errorText = error.getMessage() == null ? "" : error.getMessage();
                        dialogService.error(
                                Internationalization.text("social.messaging.title"),
                                errorText.isBlank()
                                        ? Internationalization.text("social.messaging.status.error.no.detail")
                                        : errorText);
                        setStatus(Internationalization.text("social.messaging.status.error",
                                errorText.isBlank() ? Internationalization.text("social.messaging.error.unknown") : errorText));
                        return;
                    }
                    if (messages != null) {
                        messages.forEach(messageModel::addElement);
                    }
                    if (messages == null || messages.isEmpty()) {
                        setStatus(Internationalization.text("social.messaging.list.empty"));
                    } else {
                        setStatus(Internationalization.text("social.messaging.status.loaded", messages.size()));
                    }
                    messageList.requestFocusInWindow();
                    updateButtons();
                }));
    }

    private void openSelectedMessage() {
        PrivateMessage message = messageList.getSelectedValue();
        if (message == null) {
            return;
        }
        int userId = counterpartId(message);
        String username = counterpartUsername(message);
        messagingController.openConversation(getOwner(), userId, username);
    }

    private int counterpartId(PrivateMessage message) {
        String direction = message.direction() == null ? "" : message.direction();
        if ("sent".equalsIgnoreCase(direction)) {
            return message.recipientId();
        }
        return message.senderId();
    }

    private String counterpartUsername(PrivateMessage message) {
        String direction = message.direction() == null ? "" : message.direction();
        if ("sent".equalsIgnoreCase(direction)) {
            return message.recipientUsername();
        }
        return message.senderUsername();
    }

    private void setLookupEnabled(boolean enabled) {
        lookupButton.setEnabled(enabled);
        usernameField.setEnabled(enabled);
    }

    private void setMenuEnabled(boolean enabled) {
        menuList.setEnabled(enabled);
        refreshButton.setEnabled(enabled);
        openConversationButton.setEnabled(enabled && messageList.getSelectedIndex() >= 0);
    }

    private void setStatus(String text) {
        statusLabel.setText((text == null || text.isBlank()) ? " " : text);
    }

    private void updateButtons() {
        openConversationButton.setEnabled(messageList.getSelectedIndex() >= 0);
    }

    private void suppressTab(javax.swing.JComponent component) {
        component.setFocusTraversalKeysEnabled(false);
        String noop = "noop-" + component.hashCode();
        String noopShift = "noop-shift-" + component.hashCode();
        component.getActionMap().put(noop, new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
            }
        });
        component.getActionMap().put(noopShift, new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
            }
        });
        component.getInputMap().put(KeyStroke.getKeyStroke("TAB"), noop);
        component.getInputMap().put(KeyStroke.getKeyStroke("shift TAB"), noopShift);
        component.getInputMap(javax.swing.JComponent.WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke("TAB"), noop);
        component.getInputMap(javax.swing.JComponent.WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke("shift TAB"), noopShift);
    }

    private ListSelectionListener listSelectionListener() {
        return e -> {
            if (!e.getValueIsAdjusting()) {
                updateButtons();
            }
        };
    }

    private enum MenuOption {
        COMPOSE("social.messaging.menu.compose"),
        INBOX("social.messaging.menu.inbox"),
        OUTBOX("social.messaging.menu.outbox"),
        DELETED("social.messaging.menu.deleted");

        private final String labelKey;

        MenuOption(String labelKey) {
            this.labelKey = labelKey;
        }

        String label() {
            return Internationalization.text(labelKey);
        }

        boolean isCompose() {
            return this == COMPOSE;
        }
    }

    private final class MenuRenderer extends JPanel implements ListCellRenderer<MenuOption> {
        private final JLabel label = new JLabel();

        private MenuRenderer() {
            setLayout(new BorderLayout());
            setBorder(BorderFactory.createEmptyBorder(8, 12, 8, 12));
            label.setFont(label.getFont().deriveFont(14f));
            add(label, BorderLayout.CENTER);
        }

        @Override
        public Component getListCellRendererComponent(JList<? extends MenuOption> list,
                                                      MenuOption value,
                                                      int index,
                                                      boolean isSelected,
                                                      boolean cellHasFocus) {
            label.setText(value == null ? "" : value.label());
            if (isSelected) {
                setBackground(list.getSelectionBackground());
                label.setForeground(list.getSelectionForeground());
            } else {
                setBackground(list.getBackground());
                label.setForeground(list.getForeground());
            }
            String accessible = label.getText();
            getAccessibleContext().setAccessibleName(accessible);
            AccessibilityPreferences.applyDescription(getAccessibleContext(), accessible);
            label.getAccessibleContext().setAccessibleName(accessible);
            AccessibilityPreferences.applyDescription(label.getAccessibleContext(), accessible);
            return this;
        }
    }

    private final class MessageRenderer extends JPanel implements ListCellRenderer<PrivateMessage> {
        private final JLabel title = new JLabel();
        private final JLabel preview = new JLabel();

        private MessageRenderer() {
            setLayout(new BorderLayout());
            setBorder(BorderFactory.createEmptyBorder(6, 8, 6, 8));
            preview.setForeground(Color.DARK_GRAY);
            add(title, BorderLayout.NORTH);
            add(preview, BorderLayout.CENTER);
        }

        @Override
        public Component getListCellRendererComponent(JList<? extends PrivateMessage> list,
                                                      PrivateMessage value,
                                                      int index,
                                                      boolean isSelected,
                                                      boolean cellHasFocus) {
            if (value == null) {
                title.setText("");
                preview.setText("");
            } else {
                boolean sent = "sent".equalsIgnoreCase(value.direction());
                String userLabel = sent
                        ? Internationalization.text("social.messaging.list.sent", value.recipientUsername())
                        : Internationalization.text("social.messaging.list.received", value.senderUsername());
                String timeLabel = TIME_FORMATTER.format(value.createdAt().atZone(LOCAL_ZONE));
                title.setText("[" + timeLabel + "] " + userLabel);
                preview.setText(snippet(value.text()));
            }
            if (isSelected) {
                setBackground(list.getSelectionBackground());
                setForeground(list.getSelectionForeground());
            } else {
                setBackground(list.getBackground());
                setForeground(list.getForeground());
            }
            return this;
        }
    }

    private static String snippet(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        String normalized = text.replaceAll("\\s+", " ").trim();
        if (normalized.length() > 80) {
            return normalized.substring(0, 77) + "...";
        }
        return normalized;
    }
}
