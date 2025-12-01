package com.lemondelila.client.menu.view;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.ui.component.StatusBanner;
import com.lemondelila.client.framework.ui.component.StatusBannerFactory;
import com.lemondelila.client.framework.ui.util.ButtonUtils;

import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.border.EmptyBorder;
import java.awt.Component;
import java.awt.Dimension;
import java.util.List;

public final class MainMenuView {

    private final JPanel root = new JPanel();
    private final StatusBanner statusBanner;
    private final JButton shelvesButton = new JButton(Internationalization.text("mainmenu.shelves"));
    private final JButton joinGameButton = new JButton(Internationalization.text("mainmenu.join"));
    private final JButton chatButton = new JButton(Internationalization.text("mainmenu.chat"));
    private final JButton socialButton = new JButton(Internationalization.text("mainmenu.social"));
    private final JButton optionsButton = new JButton(Internationalization.text("mainmenu.options"));
    private final JButton logoutButton = new JButton(Internationalization.text("mainmenu.logout"));

    private final List<JButton> buttons = List.of(
            shelvesButton,
            joinGameButton,
            chatButton,
            socialButton,
            optionsButton,
            logoutButton
    );

    public MainMenuView(StatusBannerFactory statusBannerFactory) {
        this.statusBanner = statusBannerFactory.create(
                Internationalization.text("mainmenu.status.banner"),
                Internationalization.text("mainmenu.status.banner.desc"),
                root
        );
        buildUi();
    }

    public JPanel component() {
        return root;
    }

    public JButton shelvesButton() {
        return shelvesButton;
    }

    public JButton joinGameButton() {
        return joinGameButton;
    }

    public JButton chatButton() {
        return chatButton;
    }

    public JButton socialButton() {
        return socialButton;
    }

    public JButton optionsButton() {
        return optionsButton;
    }

    public JButton logoutButton() {
        return logoutButton;
    }

    public List<JButton> orderedButtons() {
        return buttons;
    }

    public void setStatus(String text) {
        statusBanner.setStatus(text);
    }

    public void focusFirstButton() {
        shelvesButton.requestFocusInWindow();
    }

    private void buildUi() {
        root.setLayout(new BoxLayout(root, BoxLayout.Y_AXIS));
        root.setBorder(new EmptyBorder(48, 64, 48, 64));

        JLabel title = new JLabel(Internationalization.text("mainmenu.title"));
        title.setAlignmentX(Component.CENTER_ALIGNMENT);
        title.setFont(title.getFont().deriveFont(26f));
        AccessibleDecorator.apply(title, AccessibleSpec.builder()
                .name(Internationalization.text("mainmenu.title.accessible"))
                .description(Internationalization.text("mainmenu.title.desc"))
                .build());
        root.add(title);
        root.add(Box.createRigidArea(new Dimension(0, 32)));

        addMenuButton(shelvesButton, "mainmenu.button.shelves.desc");
        addSpacer();
        addMenuButton(joinGameButton, "mainmenu.button.join.desc");
        addSpacer();
        addMenuButton(chatButton, "mainmenu.button.chat.desc");
        addSpacer();
        addMenuButton(socialButton, "mainmenu.button.social.desc");
        addSpacer();
        addMenuButton(optionsButton, "mainmenu.button.options.desc");
        addSpacer();
        addMenuButton(logoutButton, "mainmenu.button.logout.desc");

        root.add(Box.createRigidArea(new Dimension(0, 24)));
        JLabel bannerComponent = statusBanner.component();
        bannerComponent.setAlignmentX(Component.CENTER_ALIGNMENT);
        root.add(bannerComponent);
    }

    private void addMenuButton(JButton button, String descKey) {
        button.setAlignmentX(Component.CENTER_ALIGNMENT);
        button.setMaximumSize(new Dimension(320, 48));
        button.setFocusTraversalKeysEnabled(false);
        ButtonUtils.enterActivates(button);
        AccessibleDecorator.apply(button, AccessibleSpec.builder()
                .name(button.getText())
                .description(Internationalization.text(descKey))
                .build());
        root.add(button);
    }

    private void addSpacer() {
        root.add(Box.createRigidArea(new Dimension(0, 16)));
    }
}
