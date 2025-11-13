package com.lemondelila.client.messaging.view;

import com.lemondelila.client.messaging.model.PrivateMessage;

import javax.swing.AbstractAction;
import javax.swing.DefaultListModel;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.border.EmptyBorder;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

final class PrivateConversationView {

    private static final ZoneId LOCAL_ZONE = ZoneId.systemDefault();
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

    private final JPanel root = new JPanel(new BorderLayout(8, 8));
    private final DefaultListModel<String> conversationModel = new DefaultListModel<>();
    private final JList<String> conversationList = new JList<>(conversationModel);
    private final JTextArea inputArea = new JTextArea(3, 32);
    private final JButton sendButton = new JButton("Envoyer");
    private final JLabel statusLabel = new JLabel(" ");

    PrivateConversationView(String title) {
        root.setBorder(new EmptyBorder(8, 8, 8, 8));

        conversationList.setVisibleRowCount(12);
        conversationList.setBorder(new EmptyBorder(8, 8, 8, 8));
        root.add(new JScrollPane(conversationList), BorderLayout.CENTER);

        JPanel composer = new JPanel(new BorderLayout(6, 6));
        composer.setBorder(new EmptyBorder(0, 8, 8, 8));
        inputArea.setLineWrap(true);
        inputArea.setWrapStyleWord(true);
        JScrollPane inputScroll = new JScrollPane(inputArea);
        inputScroll.setPreferredSize(new Dimension(320, 80));
        composer.add(inputScroll, BorderLayout.CENTER);
        composer.add(sendButton, BorderLayout.EAST);

        JPanel southPanel = new JPanel(new BorderLayout());
        southPanel.setBorder(new EmptyBorder(0, 8, 8, 8));
        southPanel.add(statusLabel, BorderLayout.NORTH);
        southPanel.add(composer, BorderLayout.CENTER);
        root.add(southPanel, BorderLayout.SOUTH);

        registerInputActions();
    }

    JComponent component() {
        return root;
    }

    void onSend(Runnable action) {
        sendButton.addActionListener(e -> action.run());
        inputArea.getActionMap().put("send-message", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                action.run();
            }
        });
    }

    String currentInput() {
        return inputArea.getText();
    }

    void clearInput() {
        inputArea.setText("");
    }

    void setSendEnabled(boolean enabled) {
        sendButton.setEnabled(enabled);
    }

    void focusInput() {
        SwingUtilities.invokeLater(inputArea::requestFocusInWindow);
    }

    void setStatus(String text) {
        statusLabel.setText(text == null || text.isBlank() ? " " : text);
    }

    void renderMessages(List<PrivateMessage> messages) {
        conversationModel.clear();
        messages.forEach(this::appendMessage);
        if (!messages.isEmpty()) {
            conversationList.ensureIndexIsVisible(conversationModel.getSize() - 1);
        }
    }

    void appendMessage(PrivateMessage message) {
        String timestamp = TIME_FORMATTER.format(message.createdAt().atZone(LOCAL_ZONE));
        conversationModel.addElement(
                String.format("[%s] %s : %s", timestamp, message.senderUsername(), message.text()));
        conversationList.ensureIndexIsVisible(conversationModel.getSize() - 1);
    }

    private void registerInputActions() {
        inputArea.getInputMap().put(KeyStroke.getKeyStroke("shift ENTER"), "insert-break");
        inputArea.getActionMap().put("insert-break", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                inputArea.append(System.lineSeparator());
            }
        });
        inputArea.getInputMap().put(KeyStroke.getKeyStroke("control ENTER"), "send-message");
    }
}
