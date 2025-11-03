package com.lemondelila.client.history.view;

import javax.swing.*;
import javax.swing.text.DefaultCaret;
import java.awt.*;
import java.awt.event.KeyEvent;
import java.util.Collections;
import java.util.List;

/**
 * Implementation Swing de l'affichage de l'historique.
 */
public final class SwingHistoryView extends JPanel implements HistoryView {

    private final JTextArea textArea = new JTextArea(6, 60);
    private Runnable focusForwardAction = () -> SwingUtilities.invokeLater(() -> textArea.transferFocus());
    private Runnable focusBackwardAction = () -> SwingUtilities.invokeLater(() -> textArea.transferFocusBackward());

    public SwingHistoryView() {
        super(new BorderLayout());
        setBorder(BorderFactory.createTitledBorder("Historique"));
        setFocusable(false);

        textArea.setEditable(false);
        textArea.setLineWrap(true);
        textArea.setWrapStyleWord(true);
        textArea.setMargin(new Insets(6, 6, 6, 6));
        textArea.setFont(new Font(Font.MONOSPACED, Font.PLAIN, 12));

        DefaultCaret caret = (DefaultCaret) textArea.getCaret();
        caret.setUpdatePolicy(DefaultCaret.ALWAYS_UPDATE);

        JScrollPane scrollPane = new JScrollPane(textArea,
                JScrollPane.VERTICAL_SCROLLBAR_AS_NEEDED,
                JScrollPane.HORIZONTAL_SCROLLBAR_NEVER);
        scrollPane.setBorder(BorderFactory.createEmptyBorder());

        add(scrollPane, BorderLayout.CENTER);
        setPreferredSize(new Dimension(0, 160));

        installFocusBridge();
    }

    @Override
    public void renderHistory(List<String> messages) {
        SwingUtilities.invokeLater(() -> {
            StringBuilder builder = new StringBuilder();
            for (String message : messages) {
                if (builder.length() > 0) {
                    builder.append(System.lineSeparator());
                }
                builder.append(message);
            }
            textArea.setText(builder.toString());
        });
    }

    public void setFocusBridge(Runnable forwardAction, Runnable backwardAction) {
        this.focusForwardAction = forwardAction != null
                ? forwardAction
                : () -> SwingUtilities.invokeLater(() -> textArea.transferFocus());
        this.focusBackwardAction = backwardAction != null
                ? backwardAction
                : () -> SwingUtilities.invokeLater(() -> textArea.transferFocusBackward());
    }

    public void requestHistoryFocus() {
        SwingUtilities.invokeLater(() -> textArea.requestFocusInWindow());
    }

    private void installFocusBridge() {
        textArea.setFocusTraversalKeys(KeyboardFocusManager.FORWARD_TRAVERSAL_KEYS, Collections.emptySet());
        textArea.setFocusTraversalKeys(KeyboardFocusManager.BACKWARD_TRAVERSAL_KEYS, Collections.emptySet());

        InputMap inputMap = textArea.getInputMap(JComponent.WHEN_FOCUSED);
        ActionMap actionMap = textArea.getActionMap();

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_TAB, 0), "focusForward");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_TAB, KeyEvent.SHIFT_DOWN_MASK), "focusBackward");

        actionMap.put("focusForward", new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                focusForwardAction.run();
            }
        });
        actionMap.put("focusBackward", new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                focusBackwardAction.run();
            }
        });
    }
}
