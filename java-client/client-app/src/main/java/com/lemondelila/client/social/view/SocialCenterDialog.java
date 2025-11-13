package com.lemondelila.client.social.view;

import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.messaging.controller.MessagingController;
import com.lemondelila.client.messaging.service.MessagingService;
import com.lemondelila.client.messaging.service.UserRelationshipService;
import com.lemondelila.client.user.model.ClientSession;

import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JButton;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import javax.swing.JComponent;
import javax.swing.InputMap;
import javax.swing.ActionMap;
import javax.swing.KeyStroke;
import javax.swing.border.EmptyBorder;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.Window;
import java.awt.event.ActionEvent;
import java.util.Objects;

import javax.swing.AbstractAction;

final class SocialCenterDialog extends JDialog {

    private final ClientSession session;

    private final JLabel globalStatus = new JLabel(" ");
    private final SocialRelationshipsPanel relationshipsPanel;
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
            "Amis & blocages",
            "Messagerie"
    };

    SocialCenterDialog(Window owner,
                       UserRelationshipService relationshipService,
                       MessagingService messagingService,
                       MessagingController messagingController,
                       DialogService dialogService,
                       ClientSession session) {
        super(owner, "Centre social", ModalityType.APPLICATION_MODAL);
        this.session = Objects.requireNonNull(session, "session");

        Objects.requireNonNull(relationshipService, "relationshipService");
        Objects.requireNonNull(messagingService, "messagingService");
        Objects.requireNonNull(messagingController, "messagingController");
        Objects.requireNonNull(dialogService, "dialogService");

        this.relationshipsPanel = new SocialRelationshipsPanel(
                relationshipService,
                this::updateGlobalStatus
        );
        this.messagesPanel = new SocialMessagesPanel(
                owner,
                messagingService,
                messagingController,
                relationshipService,
                dialogService,
                this::updateGlobalStatus
        );
        this.messagesPanel.setOnEscape(() -> showSection(SECTION_RELATIONSHIPS, true));

        setDefaultCloseOperation(DISPOSE_ON_CLOSE);
        setLayout(new BorderLayout(8, 8));
        add(buildContent(), BorderLayout.CENTER);
        globalStatus.setBorder(new EmptyBorder(4, 12, 8, 12));
        add(globalStatus, BorderLayout.SOUTH);

        setSize(780, 520);
        setLocationRelativeTo(owner);

        relationshipsPanel.reload();
        messagesPanel.reload();
        SwingUtilities.invokeLater(() -> showSection(SECTION_RELATIONSHIPS, true));
        session.authenticated()
                .map(ClientSession.AuthState::username)
                .ifPresentOrElse(
                        name -> updateGlobalStatus("Connecté en tant que " + name + "."),
                        () -> updateGlobalStatus("Bienvenue dans le centre social.")
                );
    }

    private JPanel buildContent() {
        JPanel container = new JPanel(new BorderLayout(8, 8));
        container.add(buildNavigationBar(), BorderLayout.NORTH);
        sectionPanel.add(relationshipsPanel, sectionKey(SECTION_RELATIONSHIPS));
        sectionPanel.add(messagesPanel, sectionKey(SECTION_MESSAGES));
        container.add(sectionPanel, BorderLayout.CENTER);
        installEscapeBinding(container);
        installEscapeBinding(sectionPanel);
        installEscapeBinding(relationshipsPanel);
        installEscapeBinding(messagesPanel);
        showSection(activeSection, false);
        return container;
    }

    private JPanel buildNavigationBar() {
        JPanel panel = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 8));
        navButtons = new JButton[SECTION_TITLES.length];
        for (int i = 0; i < SECTION_TITLES.length; i++) {
            final int index = i;
            JButton button = new JButton(SECTION_TITLES[i]);
            if (navBaseFont == null) {
                navBaseFont = button.getFont();
                navSelectedFont = navBaseFont.deriveFont(Font.BOLD);
            }
            button.addActionListener(e -> showSection(index, true));
            button.getAccessibleContext().setAccessibleName(SECTION_TITLES[i]);
            button.getAccessibleContext().setAccessibleDescription("Aller à " + SECTION_TITLES[i]);
            navButtons[i] = button;
            panel.add(button);
        }
        installEscapeBinding(panel);
        updateNavigationButtons();
        return panel;
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
            relationshipsPanel.focusFriendsList();
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
                if (navButtons != null && activeSection >= 0 && activeSection < navButtons.length) {
                    JButton current = navButtons[activeSection];
                    if (current.hasFocus() && activeSection != SECTION_RELATIONSHIPS) {
                        showSection(SECTION_RELATIONSHIPS, true);
                    } else {
                        current.requestFocusInWindow();
                    }
                }
            }
        });
    }

    private void updateGlobalStatus(String message) {
        globalStatus.setText(message == null || message.isBlank() ? " " : message);
    }
}
