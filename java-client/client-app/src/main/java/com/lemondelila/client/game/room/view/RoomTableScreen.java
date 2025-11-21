package com.lemondelila.client.game.room.view;

import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.keyboard.KeyboardBindings;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.game.history.controller.GameHistoryController;
import com.lemondelila.client.game.history.view.GameHistorySidebar;
import com.lemondelila.client.game.room.model.RoomDetailsState;
import com.lemondelila.client.game.shortcut.TableShortcutManager;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import java.awt.BorderLayout;
import java.awt.GridLayout;

/**
 * Ecran table generique avec deux zones : interaction et historique.
 * Tab / Shift+Tab alternent le focus entre les deux.
 */
public final class RoomTableScreen extends JPanel implements Screen {

    public static final ScreenId ID = ScreenId.of("room-table");

    private final RoomDetailsState detailsState;
    private final GameHistoryController historyController;
    private final GameHistorySidebar historyView;
    private final TableShortcutManager tableShortcutManager;
    private final JPanel interactionPanel = new JPanel(new GridLayout(3, 1, 8, 8));
    private final JLabel header = new JLabel();

    @Inject
    public RoomTableScreen(RoomDetailsState detailsState,
                           GameHistoryController historyController,
                           FocusHighlighter focusHighlighter,
                           TableShortcutManager tableShortcutManager) {
        super(new BorderLayout(8, 8));
        this.detailsState = detailsState;
        this.historyController = historyController;
        this.tableShortcutManager = tableShortcutManager;
        this.historyView = new GameHistorySidebar("Historique", "Historique de table", "Evenements de la table");

        buildInteractionArea(focusHighlighter);

        JPanel left = new JPanel(new BorderLayout());
        left.setBorder(BorderFactory.createEmptyBorder(8, 8, 8, 8));
        left.add(header, BorderLayout.NORTH);
        left.add(interactionPanel, BorderLayout.CENTER);

        add(left, BorderLayout.CENTER);
        add(historyView, BorderLayout.EAST);

        KeyboardBindings.disableTabTraversal(interactionPanel);
        KeyboardBindings.disableTabTraversal(historyView);
        KeyboardBindings.bindEnter(interactionPanel, interactionPanel::requestFocusInWindow, "table.enter");

        tableShortcutManager.installNavigation(this, interactionPanel, historyView);
    }

    private void buildInteractionArea(FocusHighlighter focusHighlighter) {
        JButton action = new JButton("Action de jeu");
        JLabel info = new JLabel("Utilisez Enter pour declencher, Tab pour passer a l'historique.");
        action.addActionListener(e -> historyController.addEntry("Action declenchee manuellement."));
        focusHighlighter.apply(action);
        focusHighlighter.apply(historyView);

        interactionPanel.add(action);
        interactionPanel.add(info);
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
    public void onShow(ScreenContext context) {
        Integer roomId = detailsState.roomId();
        if (roomId == null) {
            header.setText("Aucune table selectionnee");
        } else {
            header.setText("Table #" + roomId);
            historyController.addEntry("Ouverture table #" + roomId);
        }
        historyView.render(historyController.tracker(), "Pas encore d'evenement.");
        interactionPanel.requestFocusInWindow();
    }
}
