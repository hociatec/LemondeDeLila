package com.lemondelila.client.social.view;

import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.messaging.controller.MessagingController;
import com.lemondelila.client.messaging.model.PrivateMessage;
import com.lemondelila.client.messaging.service.MessagingService;
import com.lemondelila.client.messaging.service.UserRelationshipService;

import javax.swing.BorderFactory;
import javax.swing.DefaultListModel;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.JTextField;
import javax.swing.ListSelectionModel;
import javax.swing.SwingUtilities;
import javax.swing.AbstractAction;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.InputMap;
import javax.swing.ActionMap;
import javax.swing.KeyStroke;
import javax.swing.JComponent;
import javax.swing.border.EmptyBorder;
import javax.swing.event.ListSelectionListener;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.Window;
import java.awt.KeyboardFocusManager;
import java.awt.event.ActionEvent;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

final class SocialMessagesPanel extends JPanel {

    private static final DateTimeFormatter MESSAGE_FORMAT =
            DateTimeFormatter.ofPattern("dd/MM HH:mm").withZone(ZoneId.systemDefault());

    private final Window owner;
    private final MessagingService messagingService;
    private final UserRelationshipService relationshipService;
    private final MessagingController messagingController;
    private final DialogService dialogService;
    private final Consumer<String> statusListener;

    private final DefaultListModel<PrivateMessage> inboxModel = new DefaultListModel<>();
    private final DefaultListModel<PrivateMessage> outboxModel = new DefaultListModel<>();
    private final DefaultListModel<PrivateMessage> deletedModel = new DefaultListModel<>();

    private final JList<PrivateMessage> inboxList = new JList<>(inboxModel);
    private final JList<PrivateMessage> outboxList = new JList<>(outboxModel);
    private final JList<PrivateMessage> deletedList = new JList<>(deletedModel);

    private final JLabel inboxLabel = new JLabel("Messages reçus");
    private final JLabel outboxLabel = new JLabel("Messages envoyés");
    private final JLabel deletedLabel = new JLabel("Messages supprimés");

    private final JButton inboxDeleteButton = new JButton("Supprimer");
    private final JButton outboxDeleteButton = new JButton("Supprimer");
    private final JButton restoreButton = new JButton("Restaurer");

    private final JTextArea detailsArea = new JTextArea();
    private final CardLayout sectionsLayout = new CardLayout();
    private final JPanel sectionsPanel = new JPanel(sectionsLayout);

    private JPanel composePanel;
    private JTextField composeField;
    private JPanel inboxPanel;
    private JPanel outboxPanel;
    private JPanel deletedPanel;
    private JButton[] sectionButtons;
    private Runnable onEscape;
    private Font navBaseFont;
    private Font navSelectedFont;
    private int activeSection = SECTION_INBOX;

    private static final int SECTION_COMPOSE = 0;
    private static final int SECTION_INBOX = 1;
    private static final int SECTION_OUTBOX = 2;
    private static final int SECTION_DELETED = 3;
    private static final String[] SECTION_TITLES = {
            "Rédiger",
            "Messages reçus",
            "Messages envoyés",
            "Messages supprimés"
    };

    SocialMessagesPanel(Window owner,
                        MessagingService messagingService,
                        MessagingController messagingController,
                        UserRelationshipService relationshipService,
                        DialogService dialogService,
                        Consumer<String> statusListener) {
        this.owner = Objects.requireNonNull(owner, "owner");
        this.messagingService = Objects.requireNonNull(messagingService, "messagingService");
        this.messagingController = Objects.requireNonNull(messagingController, "messagingController");
        this.relationshipService = Objects.requireNonNull(relationshipService, "relationshipService");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.statusListener = Objects.requireNonNull(statusListener, "statusListener");
        buildUi();
        configureLists();
    }

    void reload() {
        loadInbox();
        loadOutbox();
        loadDeleted();
        clearSelections();
        clearDetails();
        showSection(activeSection, false);
}

    private void buildUi() {
        setLayout(new BorderLayout(8, 8));
        composePanel = buildComposePanel();
        inboxPanel = buildInboxPanel();
        outboxPanel = buildOutboxPanel();
        deletedPanel = buildDeletedPanel();

        sectionsPanel.add(composePanel, sectionKey(SECTION_COMPOSE));
        sectionsPanel.add(inboxPanel, sectionKey(SECTION_INBOX));
        sectionsPanel.add(outboxPanel, sectionKey(SECTION_OUTBOX));
        sectionsPanel.add(deletedPanel, sectionKey(SECTION_DELETED));

        add(buildNavigationBar(), BorderLayout.NORTH);
        add(sectionsPanel, BorderLayout.CENTER);
        add(buildDetailsPanel(), BorderLayout.SOUTH);
        installEscapeBinding(this);
        installEscapeBinding(sectionsPanel);
        installEscapeBinding(composePanel);
        installEscapeBinding(inboxPanel);
        installEscapeBinding(outboxPanel);
        installEscapeBinding(deletedPanel);
        showSection(activeSection);
    }

    private JPanel buildComposePanel() {
        JPanel panel = new JPanel(new BorderLayout(8, 12));
        panel.setBorder(new EmptyBorder(12, 12, 12, 12));

        JLabel instructions = new JLabel("""
Saisissez le pseudo de la personne à contacter puis validez avec Entrée.""");
        instructions.setBorder(new EmptyBorder(0, 0, 8, 0));
        panel.add(instructions, BorderLayout.NORTH);

        composeField = new JTextField();
        composeField.setColumns(24);
        composeField.getAccessibleContext().setAccessibleName("Pseudo du destinataire");
        composeField.getAccessibleContext().setAccessibleDescription("Entrez le pseudo du destinataire puis appuyez sur Entrée.");
        composeField.addActionListener(e -> composeNewMessage(composeField.getText().trim()));
        panel.add(composeField, BorderLayout.CENTER);
        return panel;
    }

    private JPanel buildInboxPanel() {
        JPanel panel = new JPanel(new BorderLayout(4, 4));
        panel.setBorder(new EmptyBorder(4, 4, 4, 4));

        inboxLabel.setBorder(new EmptyBorder(2, 2, 2, 2));
        inboxLabel.setLabelFor(inboxList);
        panel.add(inboxLabel, BorderLayout.NORTH);
        panel.add(wrapList(inboxList), BorderLayout.CENTER);

        inboxDeleteButton.addActionListener(e -> deleteSelectedMessage(inboxList));
        JPanel footer = new JPanel();
        footer.add(inboxDeleteButton);
        panel.add(footer, BorderLayout.SOUTH);
        return panel;
    }

    private JPanel buildOutboxPanel() {
        JPanel panel = new JPanel(new BorderLayout(4, 4));
        panel.setBorder(new EmptyBorder(4, 4, 4, 4));

        outboxLabel.setBorder(new EmptyBorder(2, 2, 2, 2));
        outboxLabel.setLabelFor(outboxList);
        panel.add(outboxLabel, BorderLayout.NORTH);
        panel.add(wrapList(outboxList), BorderLayout.CENTER);

        outboxDeleteButton.addActionListener(e -> deleteSelectedMessage(outboxList));
        JPanel footer = new JPanel();
        footer.add(outboxDeleteButton);
        panel.add(footer, BorderLayout.SOUTH);
        return panel;
    }

    private JPanel buildDeletedPanel() {
        JPanel panel = new JPanel(new BorderLayout(4, 4));
        panel.setBorder(new EmptyBorder(4, 4, 4, 4));

        deletedLabel.setBorder(new EmptyBorder(2, 2, 2, 2));
        deletedLabel.setLabelFor(deletedList);
        panel.add(deletedLabel, BorderLayout.NORTH);
        panel.add(wrapList(deletedList), BorderLayout.CENTER);

        restoreButton.addActionListener(e -> restoreSelectedMessage());
        JPanel footer = new JPanel();
        footer.add(restoreButton);
        panel.add(footer, BorderLayout.SOUTH);
        return panel;
    }

    private JPanel buildDetailsPanel() {
        JPanel panel = new JPanel(new BorderLayout());
        panel.setBorder(BorderFactory.createTitledBorder("Détails du message"));

        detailsArea.setEditable(false);
        detailsArea.setWrapStyleWord(true);
        detailsArea.setLineWrap(true);
        detailsArea.setOpaque(false);
        detailsArea.setBorder(new EmptyBorder(8, 8, 8, 8));
        detailsArea.setText("Sélectionnez un message pour afficher son contenu.");

        JScrollPane scroll = new JScrollPane(detailsArea);
        scroll.setBorder(new EmptyBorder(0, 8, 8, 8));
        scroll.setOpaque(false);
        scroll.getViewport().setOpaque(false);
        panel.add(scroll, BorderLayout.CENTER);
        return panel;
    }

    private JPanel buildNavigationBar() {
        JPanel panel = new JPanel();
        panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));
        panel.setBorder(new EmptyBorder(8, 8, 8, 8));

        JLabel title = new JLabel("Sections de messagerie");
        title.setFont(title.getFont().deriveFont(Font.BOLD, 16f));
        title.setAlignmentX(JComponent.LEFT_ALIGNMENT);
        panel.add(title);
        panel.add(Box.createVerticalStrut(6));

        sectionButtons = new JButton[SECTION_TITLES.length];
        for (int i = 0; i < SECTION_TITLES.length; i++) {
            final int index = i;
            JButton button = new JButton(SECTION_TITLES[i]);
            if (navBaseFont == null) {
                navBaseFont = button.getFont();
                navSelectedFont = navBaseFont.deriveFont(Font.BOLD);
            }
            button.setAlignmentX(JComponent.LEFT_ALIGNMENT);
            button.addActionListener(e -> showSection(index, true));
            button.getAccessibleContext().setAccessibleName(SECTION_TITLES[i]);
            button.getAccessibleContext().setAccessibleDescription("Aller à " + SECTION_TITLES[i]);
            sectionButtons[i] = button;
            customiseButtonNavigation(button, index, sectionButtons);
            panel.add(button);
            if (i < SECTION_TITLES.length - 1) {
                panel.add(Box.createVerticalStrut(6));
            }
        }
        installEscapeBinding(panel);
        updateSectionButtonText();
        updateNavigationButtons();
        return panel;
    }

    private void showSection(int section) {
        showSection(section, true);
    }

    private void showSection(int section, boolean focusTarget) {
        if (sectionButtons == null || sectionButtons.length == 0) {
            return;
        }
        int clamped = Math.max(0, Math.min(sectionButtons.length - 1, section));
        activeSection = clamped;
        sectionsLayout.show(sectionsPanel, sectionKey(activeSection));
        clearSelectionsExcept(currentList());
        updateNavigationButtons();
        updateButtonStates();
        if (!focusTarget) {
            return;
        }
        switch (activeSection) {
            case SECTION_COMPOSE -> {
                if (composeField != null) {
                    composeField.requestFocusInWindow();
                }
            }
            case SECTION_INBOX -> focusList(inboxList);
            case SECTION_OUTBOX -> focusList(outboxList);
            case SECTION_DELETED -> focusList(deletedList);
            default -> {
            }
        }
    }

    private void updateNavigationButtons() {
        if (sectionButtons == null) {
            return;
        }
        for (int i = 0; i < sectionButtons.length; i++) {
            JButton button = sectionButtons[i];
            boolean active = (i == activeSection);
            if (navBaseFont != null && navSelectedFont != null) {
                button.setFont(active ? navSelectedFont : navBaseFont);
            }
            button.getAccessibleContext().setAccessibleDescription(
                    active
                            ? SECTION_TITLES[i] + " sélectionné."
                            : "Aller à " + SECTION_TITLES[i]
            );
        }
    }

    private String sectionKey(int section) {
        return switch (section) {
            case SECTION_COMPOSE -> "compose";
            case SECTION_INBOX -> "inbox";
            case SECTION_OUTBOX -> "outbox";
            case SECTION_DELETED -> "deleted";
            default -> "inbox";
        };
    }

    private void installEscapeBinding(JComponent component) {
        if (component == null) {
            return;
        }
        InputMap map = component.getInputMap(JComponent.WHEN_ANCESTOR_OF_FOCUSED_COMPONENT);
        map.put(KeyStroke.getKeyStroke("ESCAPE"), "social.messages.focus-nav");
        ActionMap actions = component.getActionMap();
        actions.put("social.messages.focus-nav", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (sectionButtons != null && activeSection >= 0 && activeSection < sectionButtons.length) {
                    JButton current = sectionButtons[activeSection];
                    if (current.hasFocus()) {
                        if (onEscape != null) {
                            onEscape.run();
                        }
                    } else {
                        current.requestFocusInWindow();
                    }
                } else if (onEscape != null) {
                    onEscape.run();
                }
            }
        });
    }

    private JScrollPane wrapList(JList<PrivateMessage> list) {
        JScrollPane scroll = new JScrollPane(list);
        scroll.setBorder(BorderFactory.createLineBorder(list.getBackground().darker(), 1, true));
        return scroll;
    }

    private void configureLists() {
        configureList(inboxList);
        configureList(outboxList);
        configureList(deletedList);
        updateButtonStates();
    }

    private void configureList(JList<PrivateMessage> list) {
        list.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        list.setCellRenderer((component, value, index, isSelected, cellHasFocus) ->
                buildMessageCell(component, value, isSelected));
        list.addListSelectionListener(createSelectionListener());
    }

    private ListSelectionListener createSelectionListener() {
        return event -> {
            if (!event.getValueIsAdjusting()) {
                JList<PrivateMessage> current = currentList();
                if (current != null) {
                    PrivateMessage message = current.getSelectedValue();
                    if (message != null) {
                        showDetails(message);
                    }
                }
                updateButtonStates();
            }
        };
    }

    private void loadInbox() {
        inboxLabel.setText("Messages reçus — chargement…");
        inboxModel.clear();
        messagingService.loadInbox(200)
                .whenComplete((messages, error) -> SwingUtilities.invokeLater(() -> {
                    if (error != null) {
                        dialogService.error("Messagerie", error.getMessage());
                        inboxLabel.setText("Messages reçus");
                        return;
                    }
                    messages.forEach(inboxModel::addElement);
                    inboxLabel.setText(messages.isEmpty()
                            ? "Aucun nouveau message"
                            : "Messages reçus (" + messages.size() + ")");
                    updateButtonStates();
                }));
    }

    private void loadOutbox() {
        outboxLabel.setText("Messages envoyés — chargement…");
        outboxModel.clear();
        messagingService.loadOutbox(200)
                .whenComplete((messages, error) -> SwingUtilities.invokeLater(() -> {
                    if (error != null) {
                        dialogService.error("Messagerie", error.getMessage());
                        outboxLabel.setText("Messages envoyés");
                        return;
                    }
                    messages.forEach(outboxModel::addElement);
                    outboxLabel.setText(messages.isEmpty()
                            ? "Aucun message envoyé"
                            : "Messages envoyés (" + messages.size() + ")");
                    updateButtonStates();
                }));
    }

    private void loadDeleted() {
        deletedLabel.setText("Messages supprimés — chargement…");
        deletedModel.clear();
        messagingService.loadDeleted(200)
                .whenComplete((messages, error) -> SwingUtilities.invokeLater(() -> {
                    if (error != null) {
                        dialogService.error("Messagerie", error.getMessage());
                        deletedLabel.setText("Messages supprimés");
                        return;
                    }
                    messages.forEach(deletedModel::addElement);
                    deletedLabel.setText(messages.isEmpty()
                            ? "Aucun message supprimé"
                            : "Messages supprimés (" + messages.size() + ")");
                    updateButtonStates();
                }));
    }

    private void customiseButtonNavigation(JButton button, int index, JButton[] group) {
        button.setFocusTraversalKeys(KeyboardFocusManager.FORWARD_TRAVERSAL_KEYS, Collections.emptySet());
        button.setFocusTraversalKeys(KeyboardFocusManager.BACKWARD_TRAVERSAL_KEYS, Collections.emptySet());
        InputMap map = button.getInputMap(JComponent.WHEN_FOCUSED);
        ActionMap actions = button.getActionMap();

        map.put(KeyStroke.getKeyStroke("UP"), "nav.up");
        map.put(KeyStroke.getKeyStroke("DOWN"), "nav.down");
        actions.put("nav.up", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                int previous = (index - 1 + group.length) % group.length;
                JButton target = group[previous];
                if (target != null) {
                    target.requestFocusInWindow();
                }
            }
        });
        actions.put("nav.down", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                int next = (index + 1) % group.length;
                JButton target = group[next];
                if (target != null) {
                    target.requestFocusInWindow();
                }
            }
        });
    }

    private void updateSectionButtonText() {
        if (sectionButtons == null) {
            return;
        }
        sectionButtons[SECTION_COMPOSE].setText("Rédiger un message");
        sectionButtons[SECTION_INBOX].setText(inboxModel.isEmpty()
                ? "Réception (aucun message)"
                : "Réception (" + inboxModel.size() + ")");
        sectionButtons[SECTION_OUTBOX].setText(outboxModel.isEmpty()
                ? "Messages envoyés (aucun)"
                : "Messages envoyés (" + outboxModel.size() + ")");
        sectionButtons[SECTION_DELETED].setText(deletedModel.isEmpty()
                ? "Messages supprimés (aucun)"
                : "Messages supprimés (" + deletedModel.size() + ")");
    }

    private void deleteSelectedMessage(JList<PrivateMessage> source) {
        PrivateMessage message = source.getSelectedValue();
        if (message == null) {
            statusListener.accept("Sélectionnez un message à supprimer.");
            return;
        }
        CompletableFuture<PrivateMessage> future = messagingController.deleteMessage(message.id());
        future.whenComplete((result, error) -> SwingUtilities.invokeLater(() -> {
            if (error != null) {
                dialogService.error("Messagerie", error.getMessage());
                return;
            }
            statusListener.accept("Message supprimé.");
            int target = sectionForList(source);
            reload();
            showSection(target, true);
        }));
    }

    private void composeNewMessage(String target) {
        if (target == null) {
            statusListener.accept("Création du message annulée.");
            return;
        }
        if (target.isEmpty()) {
            dialogService.error("Messagerie", "Pseudo invalide.");
            return;
        }
        setComposeEnabled(false);
        messagingService.lookupUser(target)
                .whenComplete((user, error) -> SwingUtilities.invokeLater(() -> {
                    setComposeEnabled(true);
                    if (error != null) {
                        dialogService.error("Messagerie", error.getMessage());
                        statusListener.accept("Impossible d'ouvrir la conversation.");
                        return;
                    }
                    if (relationshipService.isBlocked(user.id())) {
                        dialogService.error("Messagerie", "Utilisateur bloqué. Débloquez-le pour discuter.");
                        return;
                    }
                    messagingController.openConversation(owner, user.id(), user.username());
                    statusListener.accept("Conversation ouverte avec " +
                            (user.username().isBlank()
                                    ? "l'utilisateur #" + user.id()
                                    : user.username()) + ".");
                    if (composeField != null) {
                        composeField.setText("");
                        composeField.requestFocusInWindow();
                    }
                }));
    }

    private void setComposeEnabled(boolean enabled) {
        if (composeField != null) {
            composeField.setEnabled(enabled);
        }
    }

    void setOnEscape(Runnable onEscape) {
        this.onEscape = onEscape;
    }

    void focusActiveSection() {
        if (sectionButtons != null && sectionButtons.length > 0) {
            SwingUtilities.invokeLater(() -> sectionButtons[activeSection].requestFocusInWindow());
        }
    }

    private void restoreSelectedMessage() {
        PrivateMessage message = deletedList.getSelectedValue();
        if (message == null) {
            statusListener.accept("Sélectionnez un message à restaurer.");
            return;
        }
        messagingController.restoreMessage(message.id())
                .whenComplete((restored, error) -> SwingUtilities.invokeLater(() -> {
                    if (error != null) {
                        dialogService.error("Messagerie", error.getMessage());
                        return;
                    }
                    statusListener.accept("Message restauré.");
                    reload();
                    showSection(SECTION_DELETED, true);
                }));
    }

    private void showDetails(PrivateMessage message) {
        String directionText = "sent".equalsIgnoreCase(message.direction())
                ? "À " + SocialDisplayUtils.safeUsername(message.recipientUsername())
                : "De " + SocialDisplayUtils.safeUsername(message.senderUsername());
        StringBuilder builder = new StringBuilder();
        builder.append("Message ")
                .append("sent".equalsIgnoreCase(message.direction()) ? "envoyé" : "reçu")
                .append(" le ")
                .append(MESSAGE_FORMAT.format(message.createdAt()))
                .append('\n')
                .append(directionText);
        if (message.isDeleted()) {
            builder.append("\nSupprimé le ")
                    .append(MESSAGE_FORMAT.format(message.deletedAt()));
        }
        builder.append("\n\n").append(message.text());
        detailsArea.setText(builder.toString());
    }

    private void clearDetails() {
        detailsArea.setText("Sélectionnez un message pour afficher son contenu.");
    }

    private void clearSelections() {
        inboxList.clearSelection();
        outboxList.clearSelection();
        deletedList.clearSelection();
    }

    private void clearSelectionsExcept(JList<PrivateMessage> keep) {
        if (keep != inboxList) {
            inboxList.clearSelection();
        }
        if (keep != outboxList) {
            outboxList.clearSelection();
        }
        if (keep != deletedList) {
            deletedList.clearSelection();
        }
    }

    private void updateButtonStates() {
        updateNavigationButtons();
        boolean composeSelected = activeSection == SECTION_COMPOSE;
        inboxDeleteButton.setEnabled(!composeSelected && !inboxModel.isEmpty() && inboxList.getSelectedIndex() >= 0);
        outboxDeleteButton.setEnabled(!composeSelected && !outboxModel.isEmpty() && outboxList.getSelectedIndex() >= 0);
        restoreButton.setEnabled(!composeSelected && !deletedModel.isEmpty() && deletedList.getSelectedIndex() >= 0);

        if (inboxList.getAccessibleContext() != null) {
            inboxList.getAccessibleContext().setAccessibleDescription(inboxModel.isEmpty()
                    ? "Aucun message reçu."
                    : inboxModel.size() + " message(s) reçus.");
        }
        if (outboxList.getAccessibleContext() != null) {
            outboxList.getAccessibleContext().setAccessibleDescription(outboxModel.isEmpty()
                    ? "Aucun message envoyé."
                    : outboxModel.size() + " message(s) envoyés.");
        }
        if (deletedList.getAccessibleContext() != null) {
            deletedList.getAccessibleContext().setAccessibleDescription(deletedModel.isEmpty()
                    ? "Aucun message supprimé."
                    : deletedModel.size() + " message(s) supprimés.");
        }
    }

    private JList<PrivateMessage> currentList() {
        return switch (activeSection) {
            case SECTION_INBOX -> inboxList;
            case SECTION_OUTBOX -> outboxList;
            case SECTION_DELETED -> deletedList;
            default -> null;
        };
    }

    private static JLabel buildMessageCell(JList<?> list, PrivateMessage message, boolean isSelected) {
        JLabel label = new JLabel();
        if (message != null) {
            boolean isReceived = "received".equalsIgnoreCase(message.direction());
            String direction = isReceived
                    ? "De " + SocialDisplayUtils.safeUsername(message.senderUsername())
                    : "À " + SocialDisplayUtils.safeUsername(message.recipientUsername());
            String preview = SocialDisplayUtils.shorten(message.text(), 80);
            String deletedSuffix = message.isDeleted() ? " (supprimé)" : "";
            label.setText(MESSAGE_FORMAT.format(message.createdAt()) + " - " + direction + " : " + preview + deletedSuffix);
        }
        if (isSelected) {
            label.setBackground(list.getSelectionBackground());
            label.setForeground(list.getSelectionForeground());
        } else {
            label.setBackground(list.getBackground());
            label.setForeground(list.getForeground());
        }
        label.setOpaque(true);
        label.setBorder(new EmptyBorder(4, 6, 4, 6));
        return label;
    }

    private int sectionForList(JList<PrivateMessage> list) {
        if (list == inboxList) {
            return SECTION_INBOX;
        }
        if (list == outboxList) {
            return SECTION_OUTBOX;
        }
        if (list == deletedList) {
            return SECTION_DELETED;
        }
        return activeSection;
    }

    private void focusList(JList<PrivateMessage> list) {
        if (list == null) {
            return;
        }
        SwingUtilities.invokeLater(() -> {
            list.requestFocusInWindow();
            if (!list.isSelectionEmpty()) {
                list.ensureIndexIsVisible(list.getSelectedIndex());
            }
        });
    }
}
