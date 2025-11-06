package com.lemondelila.framework.ui.dialog;

import javax.swing.JOptionPane;
import javax.swing.SwingUtilities;
import java.awt.Component;
import java.util.concurrent.CompletableFuture;

public final class DialogService {

    private Component parent;

    public void attach(Component parent) {
        this.parent = parent;
    }

    public void info(String title, String message) {
        SwingUtilities.invokeLater(() -> JOptionPane.showMessageDialog(parent, message, title, JOptionPane.INFORMATION_MESSAGE));
    }

    public void error(String title, String message) {
        SwingUtilities.invokeLater(() -> JOptionPane.showMessageDialog(parent, message, title, JOptionPane.ERROR_MESSAGE));
    }

    public CompletableFuture<Boolean> confirm(String title, String message) {
        CompletableFuture<Boolean> future = new CompletableFuture<>();
        SwingUtilities.invokeLater(() -> {
            int result = JOptionPane.showConfirmDialog(parent, message, title, JOptionPane.YES_NO_OPTION);
            future.complete(result == JOptionPane.YES_OPTION);
        });
        return future;
    }
}

