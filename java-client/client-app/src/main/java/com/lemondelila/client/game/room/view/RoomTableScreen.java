package com.lemondelila.client.game.room.view;

import com.lemondelila.client.application.view.menu.MainMenuScreen;
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
import com.lemondelila.client.game.room.view.BaseTableScreen;
import com.lemondelila.client.game.history.service.GameAnnouncer;
import com.lemondelila.client.game.core.service.GameInteractionRegistry;
import com.lemondelila.client.game.history.controller.GameHistoryController;
import com.lemondelila.client.game.history.view.GameHistorySidebar;
import com.lemondelila.client.game.room.model.BotState;
import com.lemondelila.client.game.room.model.RoomDetailsState;
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.game.room.event.RoomUpdated;
import com.lemondelila.client.game.room.event.RoomPrivacyChanged;
import com.lemondelila.client.game.room.event.RoomOperationFailed;
import com.lemondelila.client.game.room.view.GenericGameInteractionComponent;
import com.lemondelila.client.game.room.service.RoomRealtimeService;
import com.lemondelila.client.game.turn.model.TurnState;
import com.lemondelila.client.game.turn.view.TurnView;
import com.lemondelila.client.game.turn.model.TurnState;
import com.lemondelila.client.game.room.service.RoomLifecycleService;
import com.lemondelila.client.game.core.view.GameInteractionComponent;

import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Ecran table generique avec deux zones : interaction et historique.
 */
public final class RoomTableScreen extends BaseTableScreen {

    public static final ScreenId ID = ScreenId.of("room-table");

    private final RoomDetailsState detailsState;
    private final GameHistoryController historyController;
    private final DomainEventBus eventBus;
    private final GameAnnouncer announcer;
    private final TableState tableState;
    private final RoomLifecycleService lifecycleService;
    private final RoomRealtimeService realtimeService;
    private final RoomTableView view;
    private final GameInteractionRegistry interactionRegistry;
    private ScreenManager screenManager;
    private com.lemondelila.client.game.core.view.GameInteractionComponent currentInteraction;

    @Inject
    public RoomTableScreen(RoomDetailsState detailsState,
                           GameHistoryController historyController,
                           FocusHighlighter focusHighlighter,
                           com.lemondelila.client.game.shortcut.controller.TableShortcutManager shortcutManager,
                           DomainEventBus eventBus,
                           GameAnnouncer announcer,
                           GameHistorySidebar historySidebar,
                           TableState tableState,
                           RoomLifecycleService lifecycleService,
                           RoomRealtimeService realtimeService,
                           GameInteractionRegistry interactionRegistry) {
        super(detailsState, shortcutManager, announcer, historySidebar, eventBus);
        setLayout(new BorderLayout(8, 8));
        this.detailsState = detailsState;
        this.historyController = historyController;
        this.eventBus = eventBus;
        this.announcer = announcer;
        this.tableState = tableState;
        this.lifecycleService = lifecycleService;
        this.realtimeService = realtimeService;
        this.interactionRegistry = interactionRegistry;
        this.view = new RoomTableView(focusHighlighter, historySidebar);

        add(view, BorderLayout.CENTER);
        installShortcuts(view.interactionPanel(), view.historyComponent());
        shortcutManager.bindAll(this,
                this::handleTableSummary,
                this::handleTurnInfo,
                this::handleAddBot,
                this::handleRemoveBot,
                this::handleTogglePrivacy,
                this::handleQuit);

        subscriptions().subscribe(eventBus, BotAdded.class, e -> {
            if (!matchesCurrentRoom(e.roomId())) return;
            BotState bot = e.bot();
            if (bot != null) {
                announcer.announce(view.historySidebar(), "Bot " + bot.name() + " a rejoint la table.");
            }
        });
        subscriptions().subscribe(eventBus, BotRemoved.class, e -> {
            if (!matchesCurrentRoom(e.roomId())) return;
            String name = findBotName(e.botId(), e.name());
            announcer.announce(view.historySidebar(), name + " a quitté la table.");
        });
        subscriptions().subscribe(eventBus, BotOperationFailed.class, e -> {
            announcer.announce(view.historySidebar(), "Action bot impossible : " + e.message());
        });
        subscriptions().subscribe(eventBus, RoomUpdated.class, e -> {
            if (!matchesCurrentRoom(e.room().id())) return;
            var state = e.room();
            tableState.updateBots(state.bots());
            tableState.updatePlayers(state.players());
            tableState.updateStatus(state.status());
        });
        subscriptions().subscribe(eventBus, RoomPrivacyChanged.class, e -> {
            if (!matchesCurrentRoom(e.roomId())) return;
            String status = e.isPrivate() ? "privée" : "publique";
            announcer.announce(view.historySidebar(), "Table désormais " + status + ".");
        });
        subscriptions().subscribe(eventBus, RoomOperationFailed.class, e -> {
            announcer.announce(view.historySidebar(), "Action table impossible : " + e.message());
        });
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
        return view.interactionPanel();
    }

    @Override
    public void onShow(ScreenContext context) {
        super.onShow(context);
        this.screenManager = context.screenManager();
        setFocusable(true);
        Integer roomId = detailsState.roomId();
        String gameName = detailsState.gameType() == null ? "" : detailsState.gameType();
        swapInteraction(gameName);
        lifecycleService.trackRoom(roomId, gameName);
        if (roomId != null) {
            if (tableState.roomId() == null || !roomId.equals(tableState.roomId())) {
                tableState.setRoom(roomId, gameName);
            }
        } else {
            tableState.clear();
        }
        if (roomId == null) {
            view.headerLabel().setText("Aucune table selectionnee");
        } else {
            view.headerLabel().setText("Table #" + roomId);
            announcer.announce(view.historySidebar(), "Ouverture table #" + roomId);
        }
        if (!gameName.isBlank()) {
            view.interactionTitle().setText("Zone de jeu : " + gameName);
            view.interactionTitle().getAccessibleContext().setAccessibleName("Zone de jeu " + gameName);
            view.interactionPanel().getAccessibleContext().setAccessibleName("Zone de jeu " + gameName);
            if (roomId != null && currentInteraction != null) {
                currentInteraction.onAttach(roomId);
            }
        } else {
            view.interactionTitle().setText("Zone de jeu");
            view.interactionTitle().getAccessibleContext().setAccessibleName("Zone de jeu");
            view.interactionPanel().getAccessibleContext().setAccessibleName("Zone de jeu");
        }
        view.renderHistory(historyController);
        view.focusInteraction();
    }

    @Override
    protected void handleAddBot() {
        Integer roomId = detailsState.roomId();
        if (roomId == null) {
            announcer.announce(view.historySidebar(), "Aucune table selectionnee pour ajouter un bot.");
            return;
        }
        if (tableState.started()) {
            announcer.announce(view.historySidebar(), "La partie a commence : impossible d'ajouter un bot.");
            return;
        }
        eventBus.publish(new AddBotRequested(roomId, null));
    }

    @Override
    protected void handleRemoveBot() {
        Integer roomId = detailsState.roomId();
        if (roomId == null) {
            announcer.announce(view.historySidebar(), "Aucune table selectionnee pour retirer un bot.");
            return;
        }
        if (tableState.started()) {
            announcer.announce(view.historySidebar(), "La partie a commence : impossible de retirer un bot.");
            return;
        }
        var bots = tableState.bots();
        BotState candidate = bots.isEmpty() ? null : bots.get(bots.size() - 1);
        if (candidate == null || candidate.id() == null) {
            announcer.announce(view.historySidebar(), "Aucun bot a retirer.");
            return;
        }
        eventBus.publish(new RemoveBotRequested(roomId, candidate.id()));
    }

    private void handleTogglePrivacy() {
        Integer roomId = detailsState.roomId();
        if (roomId == null) {
            announcer.announce(view.historySidebar(), "Aucune table selectionnee pour changer la confidentialite.");
            return;
        }
        try {
            realtimeService.sendCommand("room.toggle-privacy", java.util.Map.of());
        } catch (Exception ex) {
            announcer.announce(view.historySidebar(), "Impossible de changer la confidentialite : " + ex.getMessage());
        }
    }

    @Override
    protected void handleQuit() {
        Integer roomId = detailsState.roomId();
        boolean confirmed = com.lemondelila.client.game.core.view.GameDialog.confirm(
                this,
                "Quitter la table",
                "Etes-vous sur de quitter la table ?");
        if (!confirmed) {
            SwingUtilities.invokeLater(view::focusInteraction);
            return;
        }
        announcer.announce(view.historySidebar(), "Demande de sortie de la table.");
        lifecycleService.stopTracking();
        if (roomId != null) {
            eventBus.publish(new com.lemondelila.client.game.room.event.LeaveRoomRequested(roomId));
        }
        if (screenManager != null) {
            screenManager.show(MainMenuScreen.ID);
        }
        tableState.clear();
        if (currentInteraction != null) {
            currentInteraction.onDetach();
        }
    }

    private boolean matchesCurrentRoom(int roomId) {
        Integer current = detailsState.roomId();
        return current != null && current.equals(roomId);
    }

    private String findBotName(Integer botId, String fallback) {
        if (botId != null) {
            return tableState.bots().stream()
                    .filter(b -> b.id() != null && Objects.equals(b.id(), botId))
                    .map(b -> b.name() == null || b.name().isBlank() ? "Bot" : b.name())
                    .findFirst()
                    .orElse(fallback == null || fallback.isBlank() ? "Bot" : fallback);
        }
        return fallback == null || fallback.isBlank() ? "Bot" : fallback;
    }

    private void handleTableSummary() {
        Integer roomId = detailsState.roomId();
        if (roomId == null) {
            announcer.announce(view.historySidebar(), "Aucune table selectionnee.");
            return;
        }
        var players = tableState.players();
        var bots = tableState.bots();
        String names = java.util.stream.Stream.concat(
                        players.stream().map(p -> p.username() == null ? "Joueur" : p.username()),
                        bots.stream().map(b -> b.name() == null ? "Bot" : b.name())
                )
                .filter(java.util.Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .reduce((a, b) -> a + ", " + b)
                .orElse("aucun participant");
        int count = players.size() + bots.size();
        SwingUtilities.invokeLater(() ->
                announcer.announce(view.historySidebar(), count + " personnes assises à la table : " + names + ".")
        );
    }

    private void handleTurnInfo() {
        var players = tableState.players();
        int index = tableState.turnIndex();
        int round = tableState.turnRound();
        int direction = tableState.turnDirection();
        String sens = direction == -1 ? "sens antihoraire" : "sens horaire";
        String name = (index >= 0 && index < players.size())
                ? (players.get(index).username() == null ? "Joueur" : players.get(index).username())
                : "Joueur inconnu";
        String message = "Tour de " + name + " (round " + round + ", " + sens + ").";
        view.turnView().render(new com.lemondelila.client.game.turn.model.TurnState(round, index, direction));
        announcer.announce(view.historySidebar(), message);
    }

    private void swapInteraction(String gameType) {
        if (currentInteraction != null) {
            currentInteraction.onDetach();
        }
        view.interactionPanel().removeAll();
        GameInteractionComponent component = interactionRegistry.find(gameType)
                .map(provider -> provider.create())
                .orElse(null);
        currentInteraction = component;
        if (component != null) {
            view.interactionPanel().add(component.getComponent());
            if (component instanceof com.lemondelila.client.game.core.view.PrimaryActionCapable capable) {
                javax.swing.InputMap windowMap = view.interactionPanel().getInputMap(javax.swing.JComponent.WHEN_IN_FOCUSED_WINDOW);
                javax.swing.InputMap ancestorMap = view.interactionPanel().getInputMap(javax.swing.JComponent.WHEN_ANCESTOR_OF_FOCUSED_COMPONENT);
                javax.swing.InputMap focusedMap = view.interactionPanel().getInputMap(javax.swing.JComponent.WHEN_FOCUSED);
                javax.swing.ActionMap actions = view.interactionPanel().getActionMap();
                windowMap.put(javax.swing.KeyStroke.getKeyStroke("ENTER"), "table.interaction.primary");
                ancestorMap.put(javax.swing.KeyStroke.getKeyStroke("ENTER"), "table.interaction.primary");
                focusedMap.put(javax.swing.KeyStroke.getKeyStroke("ENTER"), "table.interaction.primary");
                actions.put("table.interaction.primary", new javax.swing.AbstractAction() {
                    @Override
                    public void actionPerformed(java.awt.event.ActionEvent e) {
                        capable.triggerPrimaryAction();
                    }
                });
            }
        } else {
            view.interactionPanel().add(new javax.swing.JLabel("Aucune interface specifique pour ce jeu."));
        }
        view.interactionPanel().revalidate();
        view.interactionPanel().repaint();
    }

}
