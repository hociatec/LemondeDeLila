package com.lemondelila.client.social.view;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.social.controller.SocialMessagesCenterController;
import com.lemondelila.client.social.controller.SocialRelationshipsController;
import com.lemondelila.client.user.model.ClientSession;

import javax.swing.AbstractAction;
import javax.swing.ActionMap;
import javax.swing.InputMap;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.border.EmptyBorder;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.Window;
import java.awt.event.ActionEvent;
import java.util.Objects;
import java.util.function.Supplier;

public final class SocialCenterScreen extends JPanel implements Screen {

    public static final ScreenId ID = ScreenId.of("social");

    private final ClientSession session;
    private final JLabel globalStatus = new JLabel(" ");
    private final SocialRelationshipsContainer relationshipsContainer;
    private final SocialMessagesPanel messagesPanel;

    private final CardLayout sectionLayout = new CardLayout();
    private final JPanel sectionPanel = new JPanel(sectionLayout);
    private JButton[] navButtons;
    private Font navBaseFont;
    private Font navSelectedFont;
    private int activeSection = SECTION_RELATIONSHIPS;

    private static final int SECTION_RELATIONSHIPS = 0;
    private static final int SECTION_MESSAGES = 1;
    private static final String[] SECTION_TITLES = {
            "Amis",
            "Messagerie"
    };

    @Inject
    SocialCenterScreen(SocialRelationshipsController relationshipsController,
                       SocialMessagesCenterController messagesController,
                       DialogService dialogService,
                       ClientSession session) {
        this.session = Objects.requireNonNull(session, "session");

        Objects.requireNonNull(relationshipsController, "relationshipsController");
        Objects.requireNonNull(messagesController, "messagesController");
        Objects.requireNonNull(dialogService, "dialogService");

        Supplier<Window> ownerSupplier = () -> SwingUtilities.getWindowAncestor(SocialCenterScreen.this);
        this.relationshipsContainer = new SocialRelationshipsContainer(relationshipsController, this::updateGlobalStatus);
        this.messagesPanel = new SocialMessagesPanel(ownerSupplier, messagesController, dialogService, this::updateGlobalStatus);

        this.relationshipsContainer.setOnEscape(this::focusNavigationBar);
        this.messagesPanel.setOnEscape(this::focusNavigationBar);

        buildUi();
    }

    @Override
    public ScreenId id() {
        return ID;
    }

    @Override
    public JComponent getComponent() {
        return this;
    }

    @Override
    public void onShow(ScreenContext context) {
        reloadSections();
        SwingUtilities.invokeLater(() -> {
            showSection(SECTION_RELATIONSHIPS, true);
            updateWelcomeStatus();
        });
    }

    private void buildUi() {
        setLayout(new BorderLayout());
        JPanel content = buildContent();
        add(content, BorderLayout.CENTER);
        globalStatus.setBorder(new EmptyBorder(8, 16, 12, 16));
        add(globalStatus, BorderLayout.SOUTH);
    }

    private JPanel buildContent() {
        JPanel container = new JPanel(new BorderLayout(0, 16));
        container.setBorder(new EmptyBorder(24, 32, 24, 32));
        container.add(buildNavigationBar(), BorderLayout.NORTH);
        sectionPanel.add(relationshipsContainer, sectionKey(SECTION_RELATIONSHIPS));
        sectionPanel.add(messagesPanel, sectionKey(SECTION_MESSAGES));
        container.add(sectionPanel, BorderLayout.CENTER);
        installEscapeBinding(container);
        installEscapeBinding(sectionPanel);
        return container;
    }

    private JPanel buildNavigationBar() {
        JPanel panel = new JPanel(new FlowLayout(FlowLayout.CENTER, 16, 0));
        navButtons = new JButton[SECTION_TITLES.length];
        for (int i = 0; i < SECTION_TITLES.length; i++) {
            final int index = i;
            JButton button = new JButton(SECTION_TITLES[i]);
            if (navBaseFont == null) {
                navBaseFont = button.getFont();
                navSelectedFont = navBaseFont.deriveFont(Font.BOLD);
            }
            button.addActionListener(e -> showSection(index, true));
            configureNavKeyBindings(button, index);
            button.getAccessibleContext().setAccessibleName(SECTION_TITLES[i]);
            button.getAccessibleContext().setAccessibleDescription("Aller à " + SECTION_TITLES[i]);
            navButtons[i] = button;
            panel.add(button);
        }
        updateNavigationButtons();
        installEscapeBinding(panel);
        return panel;
    }

    private void reloadSections() {
        relationshipsContainer.reload();
        messagesPanel.reload();
    }

    private void showSection(int section, boolean focusContent) {
        if (navButtons == null || navButtons.length == 0) {
            return;
        }
        int clamped = Math.max(0, Math.min(navButtons.length - 1, section));
        activeSection = clamped;
        sectionLayout.show(sectionPanel, sectionKey(activeSection));
        updateNavigationButtons();
        if (!focusContent) {
            return;
        }
        if (activeSection == SECTION_RELATIONSHIPS) {
            relationshipsContainer.focusContent();
        } else {
            messagesPanel.focusActiveSection();
        }
    }

    private void updateNavigationButtons() {
        if (navButtons == null) {
            return;
        }
        for (int i = 0; i < navButtons.length; i++) {
            JButton button = navButtons[i];
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
            case SECTION_RELATIONSHIPS -> "relationships";
            case SECTION_MESSAGES -> "messages";
            default -> "relationships";
        };
    }

    private void installEscapeBinding(JComponent component) {
        if (component == null) {
            return;
        }
        InputMap map = component.getInputMap(JComponent.WHEN_ANCESTOR_OF_FOCUSED_COMPONENT);
        map.put(KeyStroke.getKeyStroke("ESCAPE"), "social.center.focus-nav");
        ActionMap actions = component.getActionMap();
        actions.put("social.center.focus-nav", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                focusNavigationBar();
            }
        });
    }

    private void focusNavigationBar() {
        if (navButtons == null || navButtons.length == 0) {
            return;
        }
        JButton target = navButtons[Math.max(0, Math.min(activeSection, navButtons.length - 1))];
        if (target != null) {
            SwingUtilities.invokeLater(target::requestFocusInWindow);
        }
    }

    private void configureNavKeyBindings(JButton button, int index) {
        InputMap map = button.getInputMap(JComponent.WHEN_FOCUSED);
        ActionMap actions = button.getActionMap();

        map.put(KeyStroke.getKeyStroke("LEFT"), "social.nav.left");
        map.put(KeyStroke.getKeyStroke("RIGHT"), "social.nav.right");
        map.put(KeyStroke.getKeyStroke("ENTER"), "social.nav.select");

        actions.put("social.nav.left", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (navButtons == null || navButtons.length == 0) {
                    return;
                }
                int previous = (index - 1 + navButtons.length) % navButtons.length;
                navButtons[previous].requestFocusInWindow();
            }
        });
        actions.put("social.nav.right", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (navButtons == null || navButtons.length == 0) {
                    return;
                }
                int next = (index + 1) % navButtons.length;
                navButtons[next].requestFocusInWindow();
            }
        });
        actions.put("social.nav.select", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                showSection(index, true);
            }
        });
    }

    private void updateWelcomeStatus() {
        session.authenticated()
                .map(ClientSession.AuthState::username)
                .ifPresentOrElse(
                        name -> updateGlobalStatus("Connecté en tant que " + name + "."),
                        () -> updateGlobalStatus("Bienvenue dans le module social.")
                );
    }

    private void updateGlobalStatus(String message) {
        globalStatus.setText(message == null || message.isBlank() ? " " : message);
    }
}
