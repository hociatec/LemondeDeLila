package com.lemondelila.client.game.room.view;

import com.lemondelila.client.menu.view.MainMenuScreen;
import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.game.bot.event.BotAdded;
import com.lemondelila.client.game.bot.event.BotOperationFailed;
import com.lemondelila.client.game.bot.event.BotRemoved;
import com.lemondelila.client.game.core.controller.GenericUniversalInteractionProvider;
import com.lemondelila.client.game.core.service.GameInteractionRegistry;
import com.lemondelila.client.game.core.view.GameDialog;
import com.lemondelila.client.game.core.view.GameInteractionComponent;
import com.lemondelila.client.game.core.view.PrimaryActionCapable;
import com.lemondelila.client.game.history.controller.GameHistoryController;
import com.lemondelila.client.game.history.service.GameAnnouncer;
import com.lemondelila.client.game.history.view.GameHistorySidebar;
import com.lemondelila.client.game.room.controller.RoomTableController;
import com.lemondelila.client.game.room.event.RoomCreated;
import com.lemondelila.client.game.room.event.RoomOperationFailed;
import com.lemondelila.client.game.room.event.RoomPrivacyChanged;
import com.lemondelila.client.game.room.event.RoomUpdated;
import com.lemondelila.client.game.room.model.RoomDetailsState;
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.game.room.service.RoomLifecycleService;
import com.lemondelila.client.presence.service.PresenceActivityReporter;

import javax.swing.JPanel;
import javax.swing.InputMap;
import javax.swing.ActionMap;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.JComponent;
import java.awt.BorderLayout;
import java.awt.event.InputEvent;
import java.awt.event.KeyEvent;
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
    private final RoomTableView view;
    private final GameInteractionRegistry interactionRegistry;
    private final GenericUniversalInteractionProvider defaultInteractionProvider;
    private final RoomTableController controller;
    private final PresenceActivityReporter presenceReporter;
    private boolean botShortcutsDisabled = false;
    private ScreenManager screenManager;
    private GameInteractionComponent currentInteraction;
    private String activeGameType;
    private Integer attachedRoomId;
    private AutoCloseable presenceHandle;

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
                           GameInteractionRegistry interactionRegistry,
                           GenericUniversalInteractionProvider defaultInteractionProvider,
                           RoomTableController controller,
                           PresenceActivityReporter presenceReporter) {
        super(detailsState, shortcutManager, announcer, historySidebar, eventBus);
        setLayout(new BorderLayout(8, 8));
        this.detailsState = detailsState;
        this.historyController = historyController;
        this.eventBus = eventBus;
        this.announcer = announcer;
        this.tableState = tableState;
        this.lifecycleService = lifecycleService;
        this.interactionRegistry = interactionRegistry;
        this.defaultInteractionProvider = defaultInteractionProvider; // force l'initialisation et l'enregistrement du provider générique
        this.controller = controller;
        this.presenceReporter = Objects.requireNonNull(presenceReporter, "presenceReporter");
        this.view = new RoomTableView(focusHighlighter, historySidebar);

        add(view, BorderLayout.CENTER);
        installShortcuts(view.interactionPanel(), view.historyComponent());
        shortcutManager.bindAll(this,
                this::handleTableSummary,
                this::handleTurnInfo,
                this::handleAddBot,
                this::handleRemoveBot,
                this::handleTogglePrivacy,
                this::handleLaunch,
                this::handleQuit);

        subscriptions().subscribe(eventBus, BotAdded.class, controller::onBotAdded);
        subscriptions().subscribe(eventBus, BotRemoved.class, controller::onBotRemoved);
        subscriptions().subscribe(eventBus, BotOperationFailed.class, controller::onBotOperationFailed);
        subscriptions().subscribe(eventBus, RoomUpdated.class, controller::onRoomUpdated);
        subscriptions().subscribe(eventBus, RoomPrivacyChanged.class, controller::onRoomPrivacyChanged);
        subscriptions().subscribe(eventBus, RoomOperationFailed.class, controller::onRoomOperationFailed);
        subscriptions().subscribe(eventBus, RoomCreated.class, event -> refreshFromState());
        subscriptions().subscribe(eventBus, RoomUpdated.class, event -> refreshFromState());
        subscriptions().subscribe(eventBus, RoomPrivacyChanged.class, event -> refreshFromState());
        subscriptions().subscribe(eventBus, com.lemondelila.client.game.room.event.GameStateUpdated.class, this::handleGameStateUpdated);
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
    public void onHide(ScreenContext context) {
        super.onHide(context);
        releasePresenceActivity();
    }

    @Override
    public void onShow(ScreenContext context) {
        super.onShow(context);
        this.screenManager = context.screenManager();
        setFocusable(true);
        Integer roomId = resolvedRoomId();
        String gameName = resolvedGameType();
        lifecycleService.trackRoom(roomId, gameName);
        if (roomId == null) {
            tableState.clear();
        } else if (tableState.roomId() == null || !roomId.equals(tableState.roomId())) {
            tableState.setRoom(roomId, gameName);
        }
        refreshFromState();
        view.renderHistory(historyController);
        view.focusInteraction();
        updatePresenceActivity(roomId);
    }

    @Override
    protected void handleAddBot() {
        if (tableState.started()) {
            announcer().announce(view.historySidebar(), "Impossible d'ajouter un bot : la partie est déjà lancée.");
            return;
        }
        controller.addBot();
    }

    @Override
    protected void handleRemoveBot() {
        if (tableState.started()) {
            announcer().announce(view.historySidebar(), "Impossible de retirer un bot pendant la partie.");
            return;
        }
        controller.removeBot();
    }

    private void handleLaunch() {
        if (currentInteraction instanceof PrimaryActionCapable capable) {
            capable.triggerPrimaryAction();
            if (!tableState.started()) {
                controller.requestStartGame();
            }
            return;
        }
        if (tableState.started()) {
            announcer.announce(view.historySidebar(), "La partie a déjà commencé.");
            return;
        }
        if (!hasEnoughParticipants()) {
            announcer.announce(view.historySidebar(), "Ajoutez un joueur ou un bot avant de lancer la partie.");
            return;
        }
        if (currentInteraction == null) {
            announcer.announce(view.historySidebar(), "Interface de jeu en cours de chargement, veuillez patienter.");
            return;
        }
        controller.requestStartGame();
    }

    private void handleTogglePrivacy() {
        controller.togglePrivacy();
    }

    @Override
    protected void handleQuit() {
        Integer roomId = resolvedRoomId();
        boolean confirmed = GameDialog.confirm(
                this,
                "Quitter la table",
                "Etes-vous sur de quitter la table ?");
        if (!confirmed) {
            SwingUtilities.invokeLater(view::focusInteraction);
            return;
        }
        announcer.announce(view.historySidebar(), "Demande de sortie de la table.");
        controller.stopTrackingRoom();
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
        lastDetached();
        releasePresenceActivity();
    }

    private Integer resolvedRoomId() {
        Integer id = tableState.roomId();
        if (id != null) {
            return id;
        }
        return detailsState.roomId();
    }

    private void handleTableSummary() {
        controller.announceTableSummary();
    }

    private void handleTurnInfo() {
        if (!tableState.started()) {
            return;
        }
        var turn = controller.currentTurn();
        view.turnView().render(turn);
        controller.announceTurnInfo();
    }

    private void handleGameStateUpdated(com.lemondelila.client.game.room.event.GameStateUpdated event) {
        Integer currentRoomId = resolvedRoomId();
        if (currentRoomId != null && currentRoomId == event.roomId() && currentInteraction != null) {
            SwingUtilities.invokeLater(() -> currentInteraction.refreshState());
        }
        if (tableState.started() && !botShortcutsDisabled) {
            disableBotShortcuts();
        }
    }

    private void updatePresenceActivity(Integer roomId) {
        releasePresenceActivity();
        if (roomId == null) {
            return;
        }
        presenceHandle = presenceReporter.enterTable(roomId, null);
    }

    private void releasePresenceActivity() {
        if (presenceHandle == null) {
            return;
        }
        try {
            presenceHandle.close();
        } catch (Exception ignored) {
        } finally {
            presenceHandle = null;
        }
    }

    private boolean hasEnoughParticipants() {
        return tableState.participantCountIncludingLocalParticipant() >= 2;
    }

    private void swapInteraction(String gameType) {
        if (tableState.started() && !botShortcutsDisabled) {
            disableBotShortcuts();
        }
        if (currentInteraction != null) {
            currentInteraction.onDetach();
        }
        // Repartir d'un tracking vierge pour la nouvelle table/interface.
        lifecycleService.stopTracking();
        view.interactionPanel().removeAll();
        GameInteractionComponent component = interactionRegistry.find(gameType)
                .map(provider -> provider.create())
                .orElse(null);
        currentInteraction = component;
        activeGameType = gameType;
        attachedRoomId = null;
        if (component != null) {
            view.interactionPanel().add(component.getComponent());
        } else {
            view.interactionPanel().add(new javax.swing.JLabel("Interface de jeu indisponible pour l'instant."));
        }
        view.interactionPanel().revalidate();
        view.interactionPanel().repaint();
    }

    private void disableBotShortcuts() {
        botShortcutsDisabled = true;
        InputMap windowMap = this.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        ActionMap actions = this.getActionMap();
        if (windowMap != null) {
            windowMap.remove(KeyStroke.getKeyStroke('b'));
            windowMap.remove(KeyStroke.getKeyStroke('B'));
            windowMap.remove(KeyStroke.getKeyStroke(KeyEvent.VK_B, 0));
            windowMap.remove(KeyStroke.getKeyStroke(KeyEvent.VK_B, InputEvent.SHIFT_DOWN_MASK));
        }
        if (actions != null) {
            actions.remove("table.bot.add");
            actions.remove("table.bot.remove");
        }
    }

    private void enableBotShortcuts() {
        if (!botShortcutsDisabled) return;
        botShortcutsDisabled = false;
        InputMap windowMap = this.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        ActionMap actions = this.getActionMap();
        if (windowMap != null && actions != null) {
            KeyStroke add = KeyStroke.getKeyStroke(KeyEvent.VK_B, 0);
            KeyStroke remove = KeyStroke.getKeyStroke(KeyEvent.VK_B, InputEvent.SHIFT_DOWN_MASK);
            windowMap.put(add, "table.bot.add");
            windowMap.put(remove, "table.bot.remove");
            actions.put("table.bot.add", new javax.swing.AbstractAction() {
                @Override
                public void actionPerformed(java.awt.event.ActionEvent e) {
                    handleAddBot();
                }
            });
            actions.put("table.bot.remove", new javax.swing.AbstractAction() {
                @Override
                public void actionPerformed(java.awt.event.ActionEvent e) {
                    handleRemoveBot();
                }
            });
        }
    }

    private void refreshFromState() {
        if (tableState.started() && !botShortcutsDisabled) {
            disableBotShortcuts();
        } else if (!tableState.started()) {
            enableBotShortcuts();
        }
        SwingUtilities.invokeLater(() -> {
            Integer roomId = currentUiRoomId();
            String gameType = resolvedGameType();
            updateHeader(roomId);
            updateInteractionTitle(gameType);
            boolean hasGameType = gameType != null && !gameType.isBlank();
            if (!hasGameType && (currentInteraction != null || (activeGameType != null && !activeGameType.isBlank()))) {
                swapInteraction("");
            } else if (hasGameType && !gameType.equalsIgnoreCase(coalesce(activeGameType))) {
                swapInteraction(gameType);
            } else if (!hasGameType && view.interactionPanel().getComponentCount() == 0) {
                view.interactionPanel().add(new javax.swing.JLabel("Interface de jeu en attente..."));
                view.interactionPanel().revalidate();
                view.interactionPanel().repaint();
            }
            attachInteraction(roomId);
        });
    }

    private void updateHeader(Integer roomId) {
        if (roomId == null) {
            view.headerLabel().setText("Aucune table selectionnee");
        } else {
            view.headerLabel().setText("Table #" + roomId);
        }
    }

    private void updateInteractionTitle(String gameType) {
        String normalized = (gameType == null) ? "" : gameType.trim();
        if (normalized.isBlank()) {
            view.interactionTitle().setText("Zone de jeu");
            view.interactionTitle().getAccessibleContext().setAccessibleName("Zone de jeu");
            view.interactionPanel().getAccessibleContext().setAccessibleName("Zone de jeu");
            return;
        }
        view.interactionTitle().setText("Zone de jeu : " + normalized);
        view.interactionTitle().getAccessibleContext().setAccessibleName("Zone de jeu " + normalized);
        view.interactionPanel().getAccessibleContext().setAccessibleName("Zone de jeu " + normalized);
    }

    private void attachInteraction(Integer roomId) {
        if (roomId == null || currentInteraction == null) {
            attachedRoomId = null;
            return;
        }
        if (attachedRoomId != null && attachedRoomId.equals(roomId)) {
            return;
        }
        currentInteraction.onAttach(roomId);
        attachedRoomId = roomId;
    }

    private Integer currentUiRoomId() {
        Integer id = tableState.roomId();
        if (id != null) {
            return id;
        }
        return detailsState.roomId();
    }

    private String resolvedGameType() {
        String type = tableState.gameType();
        if (type != null && !type.isBlank()) {
            return type;
        }
        type = detailsState.gameType();
        return type == null ? "" : type;
    }

    private void lastDetached() {
        attachedRoomId = null;
        activeGameType = null;
    }

    private static String coalesce(String value) {
        return value == null ? "" : value;
    }
}
