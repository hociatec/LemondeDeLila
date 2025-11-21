package com.lemondelila.client.game.room.view;

import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.ui.keyboard.KeyboardBindings;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.application.view.home.HomeScreen;
import com.lemondelila.client.application.view.menu.MainMenuScreen;
import com.lemondelila.client.game.core.GameDialog;
import com.lemondelila.client.game.core.GameTableScreen;
import com.lemondelila.client.game.history.controller.GameHistoryController;
import com.lemondelila.client.game.history.view.GameHistorySidebar;
import com.lemondelila.client.game.room.event.LeaveRoomRequested;
import com.lemondelila.client.game.room.model.RoomDetailsState;
import com.lemondelila.client.game.shortcut.TableShortcutManager;
import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;

import javax.swing.BorderFactory;
import javax.swing.BorderFactory;
import javax.swing.ActionMap;
import javax.swing.InputMap;
import javax.swing.JPanel;
import javax.swing.JLabel;
import javax.swing.KeyStroke;
import java.awt.BorderLayout;
import java.awt.GridLayout;

/**
 * Ecran table generique avec deux zones : interaction et historique.
 * Tab / Shift+Tab alternent le focus entre les deux.
 */
public final class RoomTableScreen extends JPanel implements GameTableScreen {

    public static final ScreenId ID = ScreenId.of("room-table");

    private final RoomDetailsState detailsState;
    private final GameHistoryController historyController;
    private final GameHistorySidebar historyView;
    private final DomainEventBus eventBus;
    private final TableShortcutManager tableShortcutManager;
    private final JPanel interactionPanel = new JPanel(new GridLayout(3, 1, 8, 8));
    private final JLabel header = new JLabel();
    private final JLabel interactionTitle = new JLabel();
    private ScreenManager screenManager;

    @Inject
    public RoomTableScreen(RoomDetailsState detailsState,
                           GameHistoryController historyController,
                           FocusHighlighter focusHighlighter,
                           TableShortcutManager tableShortcutManager,
                           DomainEventBus eventBus) {
        super(new BorderLayout(8, 8));
        this.detailsState = detailsState;
        this.historyController = historyController;
        this.tableShortcutManager = tableShortcutManager;
        this.eventBus = eventBus;
        this.historyView = new GameHistorySidebar("Historique", "Historique de table", "Evenements de la table");

        buildInteractionArea(focusHighlighter);

        JPanel left = new JPanel(new BorderLayout());
        left.setBorder(BorderFactory.createEmptyBorder(8, 8, 8, 8));
        JPanel titles = new JPanel(new GridLayout(2, 1));
        titles.add(header);
        titles.add(interactionTitle);
        left.add(titles, BorderLayout.NORTH);
        left.add(interactionPanel, BorderLayout.CENTER);

        add(left, BorderLayout.CENTER);
        add(historyView, BorderLayout.EAST);

        KeyboardBindings.disableTabTraversal(interactionPanel);
        KeyboardBindings.disableTabTraversal(historyView);
        KeyboardBindings.bindEnter(interactionPanel, interactionPanel::requestFocusInWindow, "table.enter");

        tableShortcutManager.installNavigation(this, interactionPanel, historyView.historyComponent());
        tableShortcutManager.bindQuit(this, this::handleQuitRequest);
    }

    private void buildInteractionArea(FocusHighlighter focusHighlighter) {
        interactionPanel.setFocusable(true);
        AccessibleDecorator.apply(interactionPanel, AccessibleSpec.builder()
                .name("Zone de jeu")
                .build());
        focusHighlighter.apply(interactionPanel);
        focusHighlighter.apply(historyView);
    }

    @Override
    public ScreenId id() {
        return ID;
    }

    @Override
    public JPanel getComponent() {
        return this;
    }

    @Override
    public JPanel interactionArea() {
        return interactionPanel;
    }

    @Override
    public void onShow(ScreenContext context) {
        this.screenManager = context.screenManager();
        Integer roomId = detailsState.roomId();
        String gameName = detailsState.gameType() == null ? "" : detailsState.gameType();
        if (roomId == null) {
            header.setText("Aucune table selectionnee");
        } else {
            header.setText("Table #" + roomId);
            historyController.addEntry("Ouverture table #" + roomId);
        }
        if (!gameName.isBlank()) {
            interactionTitle.setText("Zone de jeu : " + gameName);
            interactionTitle.getAccessibleContext().setAccessibleName("Zone de jeu " + gameName);
            interactionPanel.getAccessibleContext().setAccessibleName("Zone de jeu " + gameName);
        } else {
            interactionTitle.setText("Zone de jeu");
            interactionTitle.getAccessibleContext().setAccessibleName("Zone de jeu");
            interactionPanel.getAccessibleContext().setAccessibleName("Zone de jeu");
        }
        historyView.render(historyController.tracker(), "Pas encore d'evenement.");
        interactionPanel.requestFocusInWindow();
    }

    private void cleanupAfterLeave() {
        historyView.clear();
        historyController.clear();
        if (screenManager != null) {
            // Retour au menu principal (utilisateur connecté)
            screenManager.show(MainMenuScreen.ID);
        }
    }

    private void handleQuitRequest() {
        Integer roomId = detailsState.roomId();
        boolean confirmed = GameDialog.confirm(
                RoomTableScreen.this,
                "Quitter la table",
                "Etes-vous sur de quitter la table ?");
        if (!confirmed) {
            return;
        }
        historyController.addEntry("Demande de sortie de la table.");
        if (roomId != null) {
            eventBus.publish(new LeaveRoomRequested(roomId));
        }
        cleanupAfterLeave();
    }
}
