package com.lemondelila.client.game.room.view;

import com.lemondelila.client.application.view.menu.MainMenuScreen;
import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.ui.keyboard.KeyboardBindings;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.game.bot.event.AddBotRequested;
import com.lemondelila.client.game.bot.event.BotAdded;
import com.lemondelila.client.game.bot.event.BotOperationFailed;
import com.lemondelila.client.game.bot.event.BotRemoved;
import com.lemondelila.client.game.bot.event.RemoveBotRequested;
import com.lemondelila.client.game.core.BaseTableScreen;
import com.lemondelila.client.game.core.GameAnnouncer;
import com.lemondelila.client.game.core.GameDialog;
import com.lemondelila.client.game.history.controller.GameHistoryController;
import com.lemondelila.client.game.history.view.GameHistorySidebar;
import com.lemondelila.client.game.room.model.BotState;
import com.lemondelila.client.game.room.model.RoomDetailsState;
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.game.shortcut.TableShortcutManager;

import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.BorderFactory;
import java.awt.BorderLayout;
import java.awt.GridLayout;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Ecran table generique avec deux zones : interaction et historique.
 * Tab / Shift+Tab alternent le focus entre les deux.
 */
public final class RoomTableScreen extends BaseTableScreen {

    public static final ScreenId ID = ScreenId.of("room-table");

    private final RoomDetailsState detailsState;
    private final GameHistoryController historyController;
    private final DomainEventBus eventBus;
    private final GameAnnouncer announcer;
    private final TableState tableState;
    private final JPanel interactionPanel = new JPanel(new GridLayout(3, 1, 8, 8));
    private final JLabel header = new JLabel();
    private final JLabel interactionTitle = new JLabel();
    private final GameHistorySidebar historyView;
    private ScreenManager screenManager;

    @Inject
    public RoomTableScreen(RoomDetailsState detailsState,
                           GameHistoryController historyController,
                           FocusHighlighter focusHighlighter,
                           TableShortcutManager tableShortcutManager,
                           DomainEventBus eventBus,
                           GameAnnouncer announcer,
                           GameHistorySidebar historySidebar,
                           TableState tableState) {
        super(detailsState, tableShortcutManager, announcer, historySidebar, eventBus);
        setLayout(new BorderLayout(8, 8));
        this.detailsState = detailsState;
        this.historyController = historyController;
        this.eventBus = eventBus;
        this.announcer = announcer;
        this.historyView = historySidebar;
        this.tableState = tableState;

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

        installShortcuts();

        subscriptions().subscribe(eventBus, BotAdded.class, e -> {
            if (!matchesCurrentRoom(e.roomId())) return;
            BotState bot = e.bot();
            if (bot != null) {
                var bots = new ArrayList<>(tableState.bots());
                bots.add(bot);
                tableState.updateBots(bots);
                announcer.announce(historyView, "Bot " + bot.name() + " a rejoint la table.");
            }
        });
        subscriptions().subscribe(eventBus, BotRemoved.class, e -> {
            if (!matchesCurrentRoom(e.roomId())) return;
            BotState bot = tableState.bots().stream()
                    .filter(b -> b.id() != null && Objects.equals(b.id(), e.botId()))
                    .findFirst()
                    .orElse(null);
            var bots = new ArrayList<>(tableState.bots());
            bots.removeIf(b -> b.id() != null && Objects.equals(b.id(), e.botId()));
            tableState.updateBots(bots);
            String name = bot != null ? bot.name() : "Bot";
            announcer.announce(historyView, name + " a quitte la table.");
        });
        subscriptions().subscribe(eventBus, BotOperationFailed.class, e -> {
            announcer.announce(historyView, "Ajout de bot impossible, vous êtes trop nombreux!");
        });
    }

    private void buildInteractionArea(FocusHighlighter focusHighlighter) {
        interactionPanel.setFocusable(true);
        AccessibleDecorator.apply(interactionPanel, AccessibleSpec.builder()
                .name("Zone de jeu")
                .description("Zone principale du jeu")
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
    public JPanel interactionPanel() {
        return interactionPanel;
    }

    @Override
    public JPanel interactionArea() {
        return interactionPanel;
    }

    @Override
    public void onShow(ScreenContext context) {
        super.onShow(context);
        this.screenManager = context.screenManager();
        tableState.updateBots(List.of());
        setFocusable(true);
        Integer roomId = detailsState.roomId();
        String gameName = detailsState.gameType() == null ? "" : detailsState.gameType();
        if (roomId == null) {
            header.setText("Aucune table selectionnee");
        } else {
            header.setText("Table #" + roomId);
            announcer.announce(historyView, "Ouverture table #" + roomId);
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

    @Override
    protected void handleAddBot() {
        Integer roomId = detailsState.roomId();
        if (roomId == null) {
            announcer.announce(historyView, "Aucune table selectionnee pour ajouter un bot.");
            return;
        }
        eventBus.publish(new AddBotRequested(roomId, null));
    }

    @Override
    protected void handleRemoveBot() {
        Integer roomId = detailsState.roomId();
        if (roomId == null) {
            announcer.announce(historyView, "Aucune table selectionnee pour retirer un bot.");
            return;
        }
        var bots = tableState.bots();
        BotState candidate = bots.isEmpty() ? null : bots.get(bots.size() - 1);
        if (candidate == null || candidate.id() == null) {
            announcer.announce(historyView, "Aucun bot a retirer.");
            return;
        }
        eventBus.publish(new RemoveBotRequested(roomId, candidate.id()));
    }

    @Override
    protected void handleQuit() {
        Integer roomId = detailsState.roomId();
        boolean confirmed = GameDialog.confirm(
                this,
                "Quitter la table",
                "Etes-vous sur de quitter la table ?");
        if (!confirmed) {
            return;
        }
        announcer.announce(historyView, "Demande de sortie de la table.");
        if (roomId != null) {
            eventBus.publish(new com.lemondelila.client.game.room.event.LeaveRoomRequested(roomId));
        }
        if (screenManager != null) {
            screenManager.show(MainMenuScreen.ID);
        }
        tableState.clear();
    }

    private boolean matchesCurrentRoom(int roomId) {
        Integer current = detailsState.roomId();
        return current != null && current.equals(roomId);
    }
}
