package com.lemondelila.client.application.view.menu;

import com.lemondelila.client.framework.ui.util.ButtonUtils;

import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.border.EmptyBorder;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import java.util.List;

final class MainMenuView {

    private final JPanel root = new JPanel();
    private final JLabel statusLabel = new JLabel(" ");

    private final JButton shelvesButton = new JButton("Etageres");
    private final JButton joinGameButton = new JButton("Rejoindre une partie");
    private final JButton chatButton = new JButton("Tchat");
    private final JButton socialButton = new JButton("Social");
    private final JButton optionsButton = new JButton("Options");
    private final JButton logoutButton = new JButton("Se deconnecter");

    private final List<JButton> buttons = List.of(
            shelvesButton,
            joinGameButton,
            chatButton,
            socialButton,
            optionsButton,
            logoutButton
    );

    MainMenuView() {
        buildUi();
    }

    JPanel component() {
        return root;
    }

    JButton shelvesButton() {
        return shelvesButton;
    }

    JButton joinGameButton() {
        return joinGameButton;
    }

    JButton chatButton() {
        return chatButton;
    }

    JButton socialButton() {
        return socialButton;
    }

    JButton optionsButton() {
        return optionsButton;
    }

    JButton logoutButton() {
        return logoutButton;
    }

    List<JButton> orderedButtons() {
        return buttons;
    }

    void setStatus(String text) {
        statusLabel.setText(text == null || text.isBlank() ? " " : text);
    }

    void focusFirstButton() {
        shelvesButton.requestFocusInWindow();
    }

    private void buildUi() {
        root.setLayout(new BoxLayout(root, BoxLayout.Y_AXIS));
        root.setBorder(new EmptyBorder(48, 64, 48, 64));

        JLabel title = new JLabel("Menu principal");
        title.setAlignmentX(Component.CENTER_ALIGNMENT);
        title.setFont(title.getFont().deriveFont(26f));
        root.add(title);
        root.add(Box.createRigidArea(new Dimension(0, 32)));

        buttons.forEach(button -> {
            addMenuButton(button);
            if (button != logoutButton) {
                addSpacer();
            }
        });

        root.add(Box.createRigidArea(new Dimension(0, 24)));
        statusLabel.setAlignmentX(Component.CENTER_ALIGNMENT);
        root.add(statusLabel);
    }

    private void addMenuButton(JButton button) {
        button.setAlignmentX(Component.CENTER_ALIGNMENT);
        button.setMaximumSize(new Dimension(320, 48));
        button.setFocusTraversalKeysEnabled(false);
        ButtonUtils.enterActivates(button);
        button.addFocusListener(new FocusAdapter() {
            @Override
            public void focusGained(FocusEvent e) {
                statusLabel.setText("Selection : " + button.getText());
            }
        });
        root.add(button);
    }

    private void addSpacer() {
        root.add(Box.createRigidArea(new Dimension(0, 16)));
    }
}
