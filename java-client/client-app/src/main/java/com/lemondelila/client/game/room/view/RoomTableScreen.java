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
import com.lemondelila.client.game.core.BaseTableScreen;
import com.lemondelila.client.game.core.GameAnnouncer;
import com.lemondelila.client.game.core.GameInteractionComponent;
import com.lemondelila.client.game.core.GameInteractionRegistry;
import com.lemondelila.client.game.history.controller.GameHistoryController;
import com.lemondelila.client.game.history.view.GameHistorySidebar;
import com.lemondelila.client.game.room.model.BotState;
import com.lemondelila.client.game.room.model.RoomDetailsState;
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.game.room.model.RoomState;
import com.lemondelila.client.game.room.service.RoomApiService;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.ui.keyboard.KeyboardBindings;
import com.lemondelila.client.gamelogic.panierexpress.view.PanierExpressInteractionComponent;

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
    private final RoomApiService roomApi;
    private final TaskScheduler scheduler;
    private final RoomTableView view;
    private final GameInteractionRegistry interactionRegistry;
    private ScreenManager screenManager;
    private GameInteractionComponent currentInteraction;

    @Inject
    public RoomTableScreen(RoomDetailsState detailsState,
                           GameHistoryController historyController,
                           FocusHighlighter focusHighlighter,
                           com.lemondelila.client.game.shortcut.TableShortcutManager shortcutManager,
                           DomainEventBus eventBus,
                           GameAnnouncer announcer,
                           GameHistorySidebar historySidebar,
                           TableState tableState,
                           RoomApiService roomApi,
                           TaskScheduler scheduler,
                           GameInteractionRegistry interactionRegistry) {
        super(detailsState, shortcutManager, announcer, historySidebar, eventBus);
        setLayout(new BorderLayout(8, 8));
        this.detailsState = detailsState;
        this.historyController = historyController;
        this.eventBus = eventBus;
        this.announcer = announcer;
        this.tableState = tableState;
        this.roomApi = roomApi;
        this.scheduler = scheduler;
        this.interactionRegistry = interactionRegistry;
        this.view = new RoomTableView(focusHighlighter, historySidebar);

        add(view, BorderLayout.CENTER);
        installShortcuts(view.interactionPanel(), view.historyComponent());
        shortcutManager.bindSummary(this, this::handleTableSummary);

        subscriptions().subscribe(eventBus, BotAdded.class, e -> {
            if (!matchesCurrentRoom(e.roomId())) return;
            BotState bot = e.bot();
            if (bot != null) {
                var bots = new ArrayList<>(tableState.bots());
                bots.add(bot);
                tableState.updateBots(bots);
                announcer.announce(view.historySidebar(), "Bot " + bot.name() + " a rejoint la table.");
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
            announcer.announce(view.historySidebar(), name + " a quitte la table.");
        });
        subscriptions().subscribe(eventBus, BotOperationFailed.class, e -> {
            announcer.announce(view.historySidebar(), "Action bot impossible : " + e.message());
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
    public JPanel interactionArea() {
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
        if (roomId != null) {
            if (tableState.roomId() == null || !roomId.equals(tableState.roomId())) {
                tableState.setRoom(roomId, gameName);
            }
            scheduler.runAsync(() -> {
                try {
                    RoomState state = roomApi.fetchRoom(roomId);
                    tableState.setRoom(state.id(), state.gameType());
                    tableState.updateBots(state.bots());
                    tableState.updatePlayers(state.players());
                    tableState.updateStatus(state.status());
                } catch (Exception ignored) { }
            });
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
        if (isGameStarted()) {
            announcer.announce(view.historySidebar(), "La partie a commence : impossible d'ajouter un bot.");
            return;
        }
        announcer.announce(view.historySidebar(), "Ajout d'un bot en cours...");
        eventBus.publish(new AddBotRequested(roomId, null));
    }

    @Override
    protected void handleRemoveBot() {
        Integer roomId = detailsState.roomId();
        if (roomId == null) {
            announcer.announce(view.historySidebar(), "Aucune table selectionnee pour retirer un bot.");
            return;
        }
        var bots = tableState.bots();
        BotState candidate = bots.isEmpty() ? null : bots.get(bots.size() - 1);
        if (candidate == null || candidate.id() == null) {
            announcer.announce(view.historySidebar(), "Aucun bot a retirer.");
            return;
        }
        announcer.announce(view.historySidebar(), "Retrait du bot " + candidate.name() + "...");
        eventBus.publish(new RemoveBotRequested(roomId, candidate.id()));
    }

    @Override
    protected void handleQuit() {
        Integer roomId = detailsState.roomId();
        boolean confirmed = com.lemondelila.client.game.core.GameDialog.confirm(
                this,
                "Quitter la table",
                "Etes-vous sur de quitter la table ?");
        if (!confirmed) {
            SwingUtilities.invokeLater(view::focusInteraction);
            return;
        }
        announcer.announce(view.historySidebar(), "Demande de sortie de la table.");
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

    private void handleTableSummary() {
        Integer roomId = detailsState.roomId();
        if (roomId == null) {
            announcer.announce(view.historySidebar(), "Aucune table selectionnee.");
            return;
        }
        String game = detailsState.gameType() == null ? "" : detailsState.gameType();
        var bots = tableState.bots();
        var players = tableState.players();
        String botNames = bots.isEmpty()
                ? "aucun bot"
                : bots.stream()
                        .map(b -> b.name() == null ? "Bot" : b.name())
                        .reduce((a, b) -> a + ", " + b)
                        .orElse("bots");
        String playerNames = players.isEmpty()
                ? "aucun joueur"
                : players.stream()
                        .map(p -> p.username() == null ? "Joueur" : p.username())
                        .reduce((a, b) -> a + ", " + b)
                        .orElse("joueurs");
        announcer.announce(view.historySidebar(), "Table #" + roomId + " " + game + " : joueurs " + playerNames + "; bots " + botNames + ".");
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
            view.interactionPanel().add(component.component());
            if (component instanceof PanierExpressInteractionComponent pe) {
                KeyboardBindings.bindEnter(view.interactionPanel(), pe::triggerRoll, "panierexpress.enter.roll.container");
            }
        } else {
            view.interactionPanel().add(new javax.swing.JLabel("Aucune interface specifique pour ce jeu."));
        }
        view.interactionPanel().revalidate();
        view.interactionPanel().repaint();
    }

    private boolean isGameStarted() {
        String status = tableState.status();
        if (status != null && !"open".equalsIgnoreCase(status)) {
            return true;
        }
        Integer roomId = detailsState.roomId();
        if (roomId == null) {
            return false;
        }
        try {
            RoomState state = roomApi.fetchRoom(roomId);
            tableState.updateStatus(state.status());
            return state.status() != null && !"open".equalsIgnoreCase(state.status());
        } catch (Exception e) {
            return false;
        }
    }
}
