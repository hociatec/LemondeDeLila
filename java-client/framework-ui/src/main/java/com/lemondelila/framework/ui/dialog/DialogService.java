package com.lemondelila.framework.ui.dialog;

import javax.swing.AbstractAction;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JComponent;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.Window;
import java.awt.Dialog.ModalityType;
import java.awt.event.ActionEvent;
import java.util.concurrent.CompletableFuture;

import static javax.swing.JComponent.WHEN_ANCESTOR_OF_FOCUSED_COMPONENT;
import static javax.swing.JComponent.WHEN_FOCUSED;
import static javax.swing.JComponent.WHEN_IN_FOCUSED_WINDOW;

public final class DialogService {

    private Component parent;

    public void attach(Component parent) {
        this.parent = parent;
    }

    public void info(String title, String message) {
        SwingUtilities.invokeLater(() ->
                showMessageDialog(title, message, JOptionPane.INFORMATION_MESSAGE));
    }

    public void error(String title, String message) {
        SwingUtilities.invokeLater(() ->
                showMessageDialog(title, message, JOptionPane.ERROR_MESSAGE));
    }

    public CompletableFuture<Boolean> confirm(String title, String message) {
        CompletableFuture<Boolean> future = new CompletableFuture<>();
        SwingUtilities.invokeLater(() ->
                future.complete(showConfirmDialog(title, message) == JOptionPane.YES_OPTION));
        return future;
    }

    public CompletableFuture<Boolean> confirmGameExit(String gameName, String detail) {
        CompletableFuture<Boolean> future = new CompletableFuture<>();
        SwingUtilities.invokeLater(() ->
                future.complete(showGameExitDialog(gameName, detail)));
        return future;
    }

    public void showScrollableText(String title, String body) {
        SwingUtilities.invokeLater(() -> showScrollableDialog(title, body));
    }

    private void showMessageDialog(String title, String message, int messageType) {
        JOptionPane pane = new JOptionPane(
                message,
                messageType,
                JOptionPane.DEFAULT_OPTION
        );
        showPane(pane, title);
    }

    private int showConfirmDialog(String title, String message) {
        JOptionPane pane = new JOptionPane(
                message,
                JOptionPane.QUESTION_MESSAGE,
                JOptionPane.YES_NO_OPTION
        );
        pane.setInitialValue(JOptionPane.YES_OPTION);
        Object value = showPane(pane, title);
        if (value instanceof Integer intValue) {
            return intValue;
        }
        return JOptionPane.CLOSED_OPTION;
    }

    private boolean showGameExitDialog(String gameName, String detail) {
        JPanel content = new JPanel();
        content.setLayout(new BoxLayout(content, BoxLayout.Y_AXIS));
        content.setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));

        JLabel heading = new JLabel("Quitter \"" + gameName + "\" ?");
        heading.setFont(heading.getFont().deriveFont(16f).deriveFont(java.awt.Font.BOLD));
        content.add(heading);
        content.add(Box.createRigidArea(new Dimension(0, 6)));

        String detailMessage = (detail == null || detail.isBlank())
                ? "Toute progression non sauvegardee sera perdue."
                : detail;
        JLabel detailLabel = new JLabel(detailMessage);
        detailLabel.setFont(detailLabel.getFont().deriveFont(java.awt.Font.ITALIC, 13f));
        content.add(detailLabel);

        Object[] options = {"Oui", "Non"};
        JOptionPane pane = new JOptionPane(
                content,
                JOptionPane.QUESTION_MESSAGE,
                JOptionPane.YES_NO_OPTION,
                null,
                options,
                options[1]
        );

        disableSpaceBindings(pane);
        Object value = showPane(pane, "Quitter " + gameName);
        return options[0].equals(value);
    }

    private void showScrollableDialog(String title, String body) {
        JTextArea area = new JTextArea(body == null || body.isBlank()
                ? "Aucune information disponible."
                : body);
        area.setEditable(false);
        area.setLineWrap(true);
        area.setWrapStyleWord(true);
        area.setCaretPosition(0);

        JScrollPane scrollPane = new JScrollPane(area);
        scrollPane.setBorder(BorderFactory.createEmptyBorder());
        scrollPane.setPreferredSize(new Dimension(520, 400));

        JOptionPane pane = new JOptionPane(
                scrollPane,
                JOptionPane.INFORMATION_MESSAGE,
                JOptionPane.DEFAULT_OPTION
        );
        showPane(pane, title);
    }

    private Object showPane(JOptionPane pane, String title) {
        disableSpaceBindings(pane);
        JDialog dialog = createDialog(pane, title);
        pane.selectInitialValue();
        dialog.setVisible(true);
        dialog.dispose();
        return pane.getValue();
    }

    private JDialog createDialog(JOptionPane pane, String title) {
        Window window = parent instanceof Window w ? w : SwingUtilities.getWindowAncestor(parent);
        JDialog dialog = pane.createDialog(window, title);
        configureDialog(dialog);
        return dialog;
    }

    private void configureDialog(JDialog dialog) {
        dialog.setResizable(false);
        dialog.setModalityType(ModalityType.APPLICATION_MODAL);
        disableSpaceBindings(dialog.getRootPane());
        Container content = dialog.getContentPane();
        if (content instanceof JComponent component) {
            disableSpaceBindings(component);
        }
        for (Component child : content.getComponents()) {
            suppressSpaceRecursively(child);
        }
    }

    private void suppressSpaceRecursively(Component component) {
        if (component instanceof JComponent jComponent) {
            disableSpaceBindings(jComponent);
        }
        if (component instanceof Container container) {
            for (Component child : container.getComponents()) {
                suppressSpaceRecursively(child);
            }
        }
    }

    private void disableSpaceBindings(JComponent component) {
        KeyStroke pressed = KeyStroke.getKeyStroke("pressed SPACE");
        KeyStroke released = KeyStroke.getKeyStroke("released SPACE");
        KeyStroke typed = KeyStroke.getKeyStroke("SPACE");

        String noopAction = "dialog.noop";
        component.getActionMap().put(noopAction, new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                // Neutralise la barre d'espace
            }
        });

        component.getInputMap(WHEN_FOCUSED).put(pressed, noopAction);
        component.getInputMap(WHEN_FOCUSED).put(released, noopAction);
        component.getInputMap(WHEN_FOCUSED).put(typed, noopAction);

        component.getInputMap(WHEN_IN_FOCUSED_WINDOW).put(pressed, noopAction);
        component.getInputMap(WHEN_IN_FOCUSED_WINDOW).put(released, noopAction);
        component.getInputMap(WHEN_IN_FOCUSED_WINDOW).put(typed, noopAction);

        component.getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT).put(pressed, noopAction);
        component.getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT).put(released, noopAction);
        component.getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT).put(typed, noopAction);
    }
}
