package com.lemondelila.client.social.view;

import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.messaging.controller.MessagingController;
import com.lemondelila.client.messaging.model.PrivateMessage;
import com.lemondelila.client.messaging.service.MessagingService;

import javax.swing.AbstractAction;
import javax.swing.BorderFactory;
import javax.swing.DefaultListModel;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JMenuItem;
import javax.swing.JPanel;
import javax.swing.JPopupMenu;
import javax.swing.JScrollPane;
import javax.swing.KeyStroke;
import javax.swing.ListSelectionModel;
import javax.swing.SwingUtilities;
import javax.swing.border.EmptyBorder;
import java.awt.BorderLayout;
import java.awt.GridLayout;
import java.awt.Window;
import java.awt.event.ActionEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

final class SocialMessagesPanel extends JPanel {

    private static final DateTimeFormatter MESSAGE_FORMAT =
            DateTimeFormatter.ofPattern("dd/MM HH:mm").withZone(ZoneId.systemDefault());

    private final Window owner;
    private final MessagingService messagingService;
    private final MessagingController messagingController;
    private final DialogService dialogService;
    private final Consumer<String> statusListener;

    private final DefaultListModel<PrivateMessage> inboxModel = new DefaultListModel<>();
    private final DefaultListModel<PrivateMessage> outboxModel = new DefaultListModel<>();

    private final JList<PrivateMessage> inboxList = new JList<>(inboxModel);
    private final JList<PrivateMessage> outboxList = new JList<>(outboxModel);
    private final JLabel inboxStatus = new JLabel(" ");
    private final JLabel outboxStatus = new JLabel(" ");

    SocialMessagesPanel(Window owner,
                        MessagingService messagingService,
                        MessagingController messagingController,
                        DialogService dialogService,
                        Consumer<String> statusListener) {
        this.owner = Objects.requireNonNull(owner, "owner");
        this.messagingService = Objects.requireNonNull(messagingService, "messagingService");
        this.messagingController = Objects.requireNonNull(messagingController, "messagingController");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.statusListener = Objects.requireNonNull(statusListener, "statusListener");
        buildUi();
        configureLists();
    }

    void reload() {
        loadInbox();
        loadOutbox();
    }

    private void buildUi() {
        setLayout(new GridLayout(1, 2, 8, 0));
        add(buildInboxPanel());
        add(buildOutboxPanel());
    }

    private JPanel buildInboxPanel() {
        JPanel panel = new JPanel(new BorderLayout(4, 4));
        panel.setBorder(BorderFactory.createTitledBorder("Messages reçus"));
        panel.add(new JScrollPane(inboxList), BorderLayout.CENTER);
        panel.add(createInboxFooter(), BorderLayout.SOUTH);
        panel.add(wrapStatusLabel(inboxStatus), BorderLayout.NORTH);
        return panel;
    }

    private JPanel buildOutboxPanel() {
        JPanel panel = new JPanel(new BorderLayout(4, 4));
        panel.setBorder(BorderFactory.createTitledBorder("Messages envoyés"));
        panel.add(new JScrollPane(outboxList), BorderLayout.CENTER);
        panel.add(createOutboxFooter(), BorderLayout.SOUTH);
        panel.add(wrapStatusLabel(outboxStatus), BorderLayout.NORTH);
        return panel;
    }

    private JPanel createInboxFooter() {
        JPanel footer = new JPanel();
        JButton refresh = new JButton("Actualiser");
        refresh.addActionListener(e -> loadInbox());
        JButton reply = new JButton("Répondre");
        reply.addActionListener(e -> replyToSelectedInbox());
        footer.add(refresh);
        footer.add(reply);
        return footer;
    }

    private JPanel createOutboxFooter() {
        JPanel footer = new JPanel();
        JButton refresh = new JButton("Actualiser");
        refresh.addActionListener(e -> loadOutbox());
        JButton reply = new JButton("Répondre");
        reply.addActionListener(e -> replyToSelectedOutbox());
        footer.add(refresh);
        footer.add(reply);
        return footer;
    }

    private void configureLists() {
        inboxList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        inboxList.setCellRenderer((list, value, index, isSelected, cellHasFocus) ->
                buildMessageCell(list, value, isSelected, true));
        inboxList.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                if (SwingUtilities.isLeftMouseButton(e) && e.getClickCount() == 2) {
                    replyToSelectedInbox();
                } else if (SwingUtilities.isRightMouseButton(e)) {
                    showMessageMenu(inboxList, e, true);
                }
            }
        });
        inboxList.getInputMap().put(KeyStroke.getKeyStroke("ENTER"), "social.inbox.reply");
        inboxList.getActionMap().put("social.inbox.reply", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                replyToSelectedInbox();
            }
        });

        outboxList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        outboxList.setCellRenderer((list, value, index, isSelected, cellHasFocus) ->
                buildMessageCell(list, value, isSelected, false));
        outboxList.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                if (SwingUtilities.isLeftMouseButton(e) && e.getClickCount() == 2) {
                    replyToSelectedOutbox();
                } else if (SwingUtilities.isRightMouseButton(e)) {
                    showMessageMenu(outboxList, e, false);
                }
            }
        });
        outboxList.getInputMap().put(KeyStroke.getKeyStroke("ENTER"), "social.outbox.reply");
        outboxList.getActionMap().put("social.outbox.reply", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                replyToSelectedOutbox();
            }
        });
    }

    private void loadInbox() {
        inboxStatus.setText("Chargement des messages reçus...");
        inboxModel.clear();
        messagingService.loadInbox(200)
                .whenComplete((messages, error) -> SwingUtilities.invokeLater(() -> {
                    if (error != null) {
                        inboxStatus.setText("Erreur de chargement.");
                        dialogService.error("Messagerie", error.getMessage());
                        return;
                    }
                    messages.forEach(inboxModel::addElement);
                    inboxStatus.setText(messages.isEmpty()
                            ? "Aucun message reçu."
                            : messages.size() + " message(s) reçus.");
                }));
    }

    private void loadOutbox() {
        outboxStatus.setText("Chargement des messages envoyés...");
        outboxModel.clear();
        messagingService.loadOutbox(200)
                .whenComplete((messages, error) -> SwingUtilities.invokeLater(() -> {
                    if (error != null) {
                        outboxStatus.setText("Erreur de chargement.");
                        dialogService.error("Messagerie", error.getMessage());
                        return;
                    }
                    messages.forEach(outboxModel::addElement);
                    outboxStatus.setText(messages.isEmpty()
                            ? "Aucun message envoyé."
                            : messages.size() + " message(s) envoyés.");
                }));
    }

    private void replyToSelectedInbox() {
        PrivateMessage message = inboxList.getSelectedValue();
        if (message == null) {
            statusListener.accept("Sélectionnez un message reçu pour répondre.");
            return;
        }
        messagingController.openConversation(owner, message.senderId(), message.senderUsername());
        statusListener.accept("Réponse à " + SocialDisplayUtils.safeUsername(message.senderUsername()) + ".");
    }

    private void replyToSelectedOutbox() {
        PrivateMessage message = outboxList.getSelectedValue();
        if (message == null) {
            statusListener.accept("Sélectionnez un message envoyé pour répondre.");
            return;
        }
        messagingController.openConversation(owner, message.recipientId(), message.recipientUsername());
        statusListener.accept("Conversation reprise avec " + SocialDisplayUtils.safeUsername(message.recipientUsername()) + ".");
    }

    private void showMessageMenu(JList<PrivateMessage> list, MouseEvent event, boolean inbox) {
        int index = list.locationToIndex(event.getPoint());
        if (index < 0) {
            return;
        }
        list.setSelectedIndex(index);
        PrivateMessage message = list.getSelectedValue();
        if (message == null) {
            return;
        }
        JPopupMenu menu = new JPopupMenu();
        JMenuItem replyItem = new JMenuItem("Répondre");
        replyItem.addActionListener(e -> {
            if (inbox) {
                replyToSelectedInbox();
            } else {
                replyToSelectedOutbox();
            }
        });
        menu.add(replyItem);
        menu.show(list, event.getX(), event.getY());
    }

    private JPanel wrapStatusLabel(JLabel label) {
        JPanel wrapper = new JPanel(new BorderLayout());
        label.setBorder(new EmptyBorder(2, 4, 2, 4));
        wrapper.add(label, BorderLayout.CENTER);
        return wrapper;
    }

    private static JLabel buildMessageCell(JList<?> list, PrivateMessage message, boolean isSelected, boolean inbox) {
        JLabel label = new JLabel();
        if (message != null) {
            String direction = inbox
                    ? "De " + SocialDisplayUtils.safeUsername(message.senderUsername())
                    : "À " + SocialDisplayUtils.safeUsername(message.recipientUsername());
            String preview = SocialDisplayUtils.shorten(message.text(), 80);
            label.setText(MESSAGE_FORMAT.format(message.createdAt()) + " - " + direction + " : " + preview);
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
}

