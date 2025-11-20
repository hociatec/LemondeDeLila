package com.lemondelila.client.game.view;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.catalogue.service.GameRulesService;
import com.lemondelila.client.framework.access.NarrationQueue;
import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.access.shortcut.ShortcutBinder;
import com.lemondelila.client.framework.ui.component.NarrationPanel;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.game.controller.GameActionState;
import com.lemondelila.client.game.controller.GameScreenController;
import com.lemondelila.client.game.model.GameSession;
import com.lemondelila.client.game.service.GameCommandCenter;
import com.lemondelila.client.game.table.TableSnapshot;
import com.lemondelila.client.game.view.GameScreenScaffold;

import javax.swing.JComponent;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import javax.swing.Timer;
import java.awt.BorderLayout;
import com.lemondelila.client.framework.access.game.GameHistoryTracker;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.function.BiFunction;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.IntConsumer;
import java.util.function.IntFunction;
import java.util.function.Supplier;

public abstract class AbstractGameRootView<S extends GameSession<?>> extends AbstractGameScreen {

    private final GameSummary summary;
    private final GameScreenController<S> controller;
    private final Supplier<NarrationQueue> narrationQueueSupplier;
    private final DialogService dialogService;
    private final GameRulesBridge rulesBridge;
    private final AccessibleShortcutRegistry shortcutRegistry;
    private final GameCommandCenter commandCenter;
    private final NarrationPanel narrationPanel;
    private final JComponent mainPanel;
    private final Supplier<Optional<String>> currentUserSupplier;
    private final JPanel headerContainer = new JPanel(new BorderLayout());
    private final ScreenId quitDestination;
    private GameScreenScaffold scaffold;
    private final Timer autoRefreshTimer;
    private long lastAutoRefreshRequest;
    private String lastTurnAnnouncementSignature;
    private final GameHistoryTracker historyTracker = new GameHistoryTracker();
    private final Deque<String> localHistory = new ArrayDeque<>();
    private List<String> lastServerHistory = List.of();
    private final Consumer<S> sessionListener = this::handleSession;
    private S currentSession;

    protected AbstractGameRootView(ScreenId id,
                                   GameSummary summary,
                                   GameScreenController<S> controller,
                                   Supplier<NarrationQueue> narrationQueueSupplier,
                                   DialogService dialogService,
                                   GameRulesBridge rulesBridge,
                                   AccessibleShortcutRegistry shortcutRegistry,
                                   GameCommandCenter commandCenter,
                                   NarrationPanel narrationPanel,
                                   JComponent mainPanel,
                                   Supplier<Optional<String>> currentUserSupplier,
                                   ScreenId quitDestination) {
        super(id, null);
        this.summary = Objects.requireNonNull(summary, "summary");
        this.controller = Objects.requireNonNull(controller, "controller");
        this.narrationQueueSupplier = Objects.requireNonNull(narrationQueueSupplier, "narrationQueueSupplier");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.rulesBridge = Objects.requireNonNull(rulesBridge, "rulesBridge");
        this.shortcutRegistry = Objects.requireNonNull(shortcutRegistry, "shortcutRegistry");
        this.commandCenter = Objects.requireNonNull(commandCenter, "commandCenter");
        this.narrationPanel = Objects.requireNonNull(narrationPanel, "narrationPanel");
        this.mainPanel = Objects.requireNonNull(mainPanel, "mainPanel");
        this.currentUserSupplier = Objects.requireNonNull(currentUserSupplier, "currentUserSupplier");
        this.quitDestination = Objects.requireNonNull(quitDestination, "quitDestination");
        setLayout(new BorderLayout());
        add(mainPanel, BorderLayout.CENTER);
        JPanel footer = new JPanel(new BorderLayout());
        footer.setOpaque(false);
        headerContainer.setOpaque(false);
        footer.add(headerContainer, BorderLayout.CENTER);
        footer.add(narrationPanel.component(), BorderLayout.SOUTH);
        add(footer, BorderLayout.SOUTH);
        scaffold = buildScaffold();
        installCommonShortcuts();
        autoRefreshTimer = new Timer(1500, event -> onAutoRefreshTick());
        autoRefreshTimer.setRepeats(true);
        autoRefreshTimer.stop();
    }

    private GameScreenScaffold buildScaffold() {
        GameActionState actionState = ensureGameActionState();
        GameScreenScaffold.Builder builder = GameScreenScaffold.builder(
                this,
                summary,
                dialogService,
                rulesBridge.rulesService(),
                shortcutRegistry,
                commandCenter,
                narrationQueueSupplier,
                narrationPanel);
        builder.withActionState(actionState);
        builder.withShortcutTargets(mainPanel);
        configureScaffold(builder);
        return builder.build();
    }

    private void installCommonShortcuts() {
        ShortcutBinder binder = scaffold.binder();
        binder.registerStroke("TAB",
                "game.focus.history",
                rulesBridge.tabShortcutDescription(),
                e -> focusHistoryArea());
        binder.registerStroke("shift TAB",
                "game.focus.main",
                rulesBridge.shiftTabShortcutDescription(),
                e -> focusMainArea());
        binder.registerStroke("ENTER",
                "game.primary",
                rulesBridge.enterShortcutDescription(),
                e -> onPrimaryAction());
        binder.registerLetter('s',
                "game.announce.score",
                Internationalization.text("game.shortcut.score.desc"),
                e -> onAnnounceScore(),
                this::canAnnounceScore);
        configureShortcuts(binder);
        BotControlConfig botConfig = botControls();
        if (botConfig != null) {
            registerBotShortcuts(binder, botConfig);
        }
    }

    protected ShortcutBinder binder() {
        return scaffold.binder();
    }

    @Override
    public void onShow(ScreenContext context) {
        super.onShow(context);
        scaffold.bindDialog(this);
        scaffold.applyShortcutScope(this, mainPanel);
        controller.addSessionListener(sessionListener);
        controller.currentSession().ifPresent(this::handleSession);
        if (controller.currentSession().isPresent()) {
            controller.refreshGame();
        }
    }

    @Override
    public void onHide(ScreenContext context) {
        super.onHide(context);
        controller.removeSessionListener(sessionListener);
        scaffold.resetShortcutScope();
        scaffold.releaseDialog();
        autoRefreshTimer.stop();
    }

    private void handleSession(S session) {
        S previous = this.currentSession;
        if (session == null) {
            this.currentSession = null;
            lastTurnAnnouncementSignature = null;
            autoRefreshTimer.stop();
            onSessionCleared(previous);
            return;
        }
        this.currentSession = session;
        if (isNewRoom(previous, session)) {
            onSessionSwitched(previous, session);
        }
        renderSession(session);
        updateTurnAnnouncement(session);
        updateAutoRefresh(session);
    }

    protected boolean isNewRoom(S previous, S current) {
        if (previous == null || current == null) {
            return true;
        }
        return previous.roomId() != current.roomId();
    }

    protected Optional<S> currentSession() {
        return Optional.ofNullable(currentSession);
    }

    protected Optional<TableSnapshot> currentTableSnapshot() {
        return currentSession()
                .flatMap(GameSession::tableInfo);
    }

    protected String describeCurrentTable(int fallbackBotCount) {
        LobbyDescriptionStrings strings = lobbyDescriptionStrings();
        return currentTableSnapshot()
                .map(snapshot -> describeTableSnapshot(snapshot, strings))
                .orElseGet(() -> describePendingLobby(strings, fallbackBotCount));
    }

    private String describeTableSnapshot(TableSnapshot snapshot,
                                         LobbyDescriptionStrings strings) {
        if (snapshot == null) {
            return describePendingLobby(strings, 0);
        }
        int humans = Math.max(0, snapshot.humanPlayers());
        int bots = Math.max(0, snapshot.botPlayers());
        if (humans <= 1 && bots == 0) {
            return strings.solo().get();
        }
        if (humans <= 1) {
            return strings.withBots().apply(Math.max(0, bots));
        }
        return strings.summary().apply(humans, bots);
    }

    private String describePendingLobby(LobbyDescriptionStrings strings,
                                        int fallbackBots) {
        if (fallbackBots <= 0) {
            return strings.solo().get();
        }
        return strings.withBots().apply(fallbackBots);
    }

    protected GameSummary gameSummary() {
        return summary;
    }

    protected Optional<String> currentUsername() {
        try {
            Optional<String> raw = currentUserSupplier.get();
            return raw.filter(name -> name != null && !name.isBlank());
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    protected <P> Optional<P> findCurrentPlayer(List<P> players,
                                                Function<P, String> usernameExtractor) {
        Optional<String> current = currentUsername();
        if (current.isEmpty() || players == null || usernameExtractor == null) {
            return Optional.empty();
        }
        String target = current.get();
        return players.stream()
                .filter(Objects::nonNull)
                .filter(player -> {
                    String username = usernameExtractor.apply(player);
                    return username != null && username.equalsIgnoreCase(target);
                })
                .findFirst();
    }

    protected <P> Optional<Integer> playerIdForCurrentUser(List<P> players,
                                                           Function<P, Integer> idExtractor,
                                                           Function<P, String> usernameExtractor) {
        if (idExtractor == null) {
            return Optional.empty();
        }
        return findCurrentPlayer(players, usernameExtractor).map(idExtractor);
    }

    protected <P> boolean isPendingForCurrentPlayer(List<P> players,
                                                    Function<P, Integer> idExtractor,
                                                    Function<P, String> usernameExtractor,
                                                    Integer pendingPlayerId) {
        if (pendingPlayerId == null) {
            return false;
        }
        return playerIdForCurrentUser(players, idExtractor, usernameExtractor)
                .map(id -> id == pendingPlayerId)
                .orElse(false);
    }

    protected String formatPlayerLabel(String username,
                                       boolean isBot,
                                       PlayerDisplayStrings strings) {
        Objects.requireNonNull(strings, "strings");
        String base = currentUsername()
                .filter(current -> username != null && username.equalsIgnoreCase(current))
                .map(ignore -> strings.self())
                .orElseGet(() -> (username == null || username.isBlank())
                        ? strings.defaultLabel()
                        : username);
        if (isBot) {
            base = base + strings.botSuffix();
        }
        return base;
    }

    protected void narrate(String message) {
        scaffold.narrate(message);
    }

    protected void narrateLaunchStart() {
        narrate(Internationalization.text("game.primary.launch.confirmed", summary.name()));
    }

    protected void configureScaffold(GameScreenScaffold.Builder builder) {
        // hook for subclasses
    }

    protected void configureShortcuts(ShortcutBinder binder) {
        // hook for subclasses
    }

    protected BotControlConfig botControls() {
        return null;
    }

    protected void registerChoiceShortcuts(ShortcutBinder binder,
                                           int choiceCount,
                                           IntConsumer handler,
                                           BooleanSupplier guard,
                                           IntFunction<String> descriptionProvider) {
        if (binder == null || handler == null || choiceCount <= 0) {
            return;
        }
        BooleanSupplier effectiveGuard = guard == null ? () -> true : guard;
        for (int index = 0; index < choiceCount; index++) {
            final int answerIndex = index;
            String description = descriptionProvider == null
                    ? "Choix " + (index + 1)
                    : descriptionProvider.apply(index + 1);
            binder.registerStroke(KeyStroke.getKeyStroke((char) ('1' + index)),
                    "game.choice." + index,
                    description,
                    e -> handler.accept(answerIndex),
                    effectiveGuard);
        }
    }

    private void registerBotShortcuts(ShortcutBinder binder, BotControlConfig config) {
        if (binder == null || config == null) {
            return;
        }
        binder.registerStroke(KeyStroke.getKeyStroke("typed b"),
                "game.bot.add",
                config.addShortcutDescription(),
                e -> handleBotShortcut(true, config));
        binder.registerStroke("shift B",
                "game.bot.remove",
                config.removeShortcutDescription(),
                e -> handleBotShortcut(false, config));
    }

    private void handleBotShortcut(boolean add,
                                   BotControlConfig config) {
        BooleanSupplier guard = config.guard() == null ? () -> true : config.guard();
        if (!guard.getAsBoolean()) {
            return;
        }
        String pending = add ? config.addPendingNarration() : config.removePendingNarration();
        narrateIfPresent(pending);
        CompletableFuture<?> future;
        BotControlConfig.BotActionHandler handler = config.handler();
        if (handler != null) {
            future = add ? handler.add() : handler.remove();
        } else {
            future = add ? controller.addBot() : controller.removeBot();
        }
        future.exceptionally(error -> {
            String failure = add ? config.addFailedNarration() : config.removeFailedNarration();
            narrateIfPresent(failure);
            return null;
        });
    }

    private void narrateIfPresent(String message) {
        if (message != null && !message.isBlank()) {
            narrate(message);
        }
    }

    protected void onSessionCleared(S previous) {
        showLobby();
    }

    protected void onSessionSwitched(S previous, S current) {
        // hook
    }

    protected void setHeaderContent(JComponent component) {
        headerContainer.removeAll();
        if (component != null) {
            headerContainer.add(component, BorderLayout.CENTER);
        }
        headerContainer.revalidate();
        headerContainer.repaint();
    }

    protected void showLobby() {
        // hook
    }

    protected void resetInfoPanels(AbstractGamePanel panel, LobbyTexts texts) {
        panel.updateStatus(texts.status(), texts.statusDescription());
        panel.updatePending(texts.pendingMessage());
        panel.updateYourProgress("");
        panel.updatePlayers("");
        panel.updateScore("");
        resetHistory(panel, texts.emptyHistoryText());
    }

    protected GameHistoryTracker historyTracker() {
        return historyTracker;
    }

    protected void resetHistory(AbstractGamePanel panel, String emptyMessage) {
        historyTracker.clear();
        localHistory.clear();
        lastServerHistory = List.of();
        panel.updateHistory(historyTracker, emptyMessage);
    }

    protected List<String> applyServerHistory(List<String> rawMessages, AbstractGamePanel panel, String emptyMessage) {
        List<String> sanitized = sanitizeMessages(rawMessages);
        List<String> delta = diffServerHistory(sanitized);
        refreshHistory(historyTracker, sanitized);
        reapplyLocalHistoryEntries();
        panel.updateHistory(historyTracker, emptyMessage);
        return delta;
    }

    protected void addLocalHistoryEntry(String entry, AbstractGamePanel panel, String emptyMessage) {
        if (entry == null || entry.isBlank()) {
            return;
        }
        if (localHistory.size() >= 20) {
            localHistory.removeFirst();
        }
        String sanitized = entry.strip();
        localHistory.addLast(sanitized);
        historyTracker.add(sanitized);
        panel.updateHistory(historyTracker, emptyMessage);
    }

    protected void refreshHistory(GameHistoryTracker tracker,
                                  List<String> rawMessages) {
        tracker.setEntries(sanitizeMessages(rawMessages));
    }

    protected List<String> sanitizeMessages(List<String> messages) {
        if (messages == null || messages.isEmpty()) {
            return List.of();
        }
        return messages.stream()
                .filter(Objects::nonNull)
                .map(String::strip)
                .filter(value -> value != null && !value.isBlank())
                .toList();
    }

    private List<String> diffServerHistory(List<String> currentLogs) {
        if (currentLogs.isEmpty()) {
            lastServerHistory = List.of();
            return List.of();
        }
        int maxOverlap = Math.min(lastServerHistory.size(), currentLogs.size());
        int overlap = 0;
        for (int candidate = maxOverlap; candidate >= 0; candidate--) {
            boolean matches = true;
            for (int i = 0; i < candidate; i++) {
                String previousValue = lastServerHistory.get(lastServerHistory.size() - candidate + i);
                String currentValue = currentLogs.get(i);
                if (!Objects.equals(previousValue, currentValue)) {
                    matches = false;
                    break;
                }
            }
            if (matches) {
                overlap = candidate;
                break;
            }
        }
        List<String> delta = overlap >= currentLogs.size()
                ? List.of()
                : currentLogs.subList(overlap, currentLogs.size());
        lastServerHistory = List.copyOf(currentLogs);
        return delta;
    }

    private void reapplyLocalHistoryEntries() {
        if (localHistory.isEmpty()) {
            return;
        }
        for (String entry : localHistory) {
            historyTracker.add(entry);
        }
    }

    protected abstract void renderSession(S session);

    protected abstract void onPrimaryAction();

    protected abstract void focusHistoryArea();

    protected abstract void focusMainArea();

    protected boolean canAnnounceScore() {
        return currentSession()
                .map(GameSession::state)
                .map(Objects::nonNull)
                .orElse(false);
    }

    protected void onAnnounceScore() {
        narrate(Internationalization.text("game.score.unavailable"));
    }

    protected void handleQuit() {
        controller.reset();
        navigate(quitDestination);
    }

    public record GameRulesBridge(GameRulesService rulesService,
                                  String tabShortcutDescription,
                                  String shiftTabShortcutDescription,
                                  String enterShortcutDescription) {
    }

    public record PlayerDisplayStrings(String self,
                                       String botSuffix,
                                       String defaultLabel) {
    }

    public record LobbyTexts(String status,
                             String statusDescription,
                             String hint,
                             String pendingMessage,
                             String emptyHistoryText) {
    }

    public record BotControlConfig(BooleanSupplier guard,
                                   String addShortcutDescription,
                                   String removeShortcutDescription,
                                   String addPendingNarration,
                                   String removePendingNarration,
                                   String unavailableNarration,
                                   String addFailedNarration,
                                   String removeFailedNarration,
                                   BotActionHandler handler) {

        public interface BotActionHandler {
            CompletableFuture<?> add();

            CompletableFuture<?> remove();
        }
    }

    /**
     * Permet aux jeux de personnaliser la narration du lobby (solo, bots, etc.).
     * En surchargant cette méthode, une RootView peut injecter ses propres textes,
     * tout en conservant la logique de calcul commune.
     */
    protected LobbyDescriptionStrings lobbyDescriptionStrings() {
        return LobbyDescriptionStrings.defaults();
    }

    protected AutoRefreshStrategy<S> autoRefreshStrategy() {
        return null;
    }

    protected boolean shouldAnnounceCurrentTurn(S session) {
        return false;
    }

    protected String turnAnnouncementSignature(S session) {
        return null;
    }

    private void updateAutoRefresh(S session) {
        AutoRefreshStrategy<S> strategy = autoRefreshStrategy();
        if (strategy == null || session == null || !strategy.shouldAutoRefresh(session)) {
            autoRefreshTimer.stop();
            return;
        }
        int delay = (int) Math.max(250, strategy.intervalMs());
        if (autoRefreshTimer.getDelay() != delay) {
            autoRefreshTimer.setDelay(delay);
        }
        if (!autoRefreshTimer.isRunning()) {
            lastAutoRefreshRequest = 0;
            autoRefreshTimer.start();
        }
    }

    private void onAutoRefreshTick() {
        long now = System.currentTimeMillis();
        if (now - lastAutoRefreshRequest < autoRefreshTimer.getDelay() / 2L) {
            return;
        }
        lastAutoRefreshRequest = now;
        controller.refreshGame();
    }

    private void updateTurnAnnouncement(S session) {
        if (session == null || !shouldAnnounceCurrentTurn(session)) {
            lastTurnAnnouncementSignature = null;
            return;
        }
        String signature = turnAnnouncementSignature(session);
        if (signature == null || signature.isBlank()) {
            return;
        }
        if (signature.equals(lastTurnAnnouncementSignature)) {
            return;
        }
        lastTurnAnnouncementSignature = signature;
        announceCurrentTurn();
    }

    public record LobbyDescriptionStrings(Supplier<String> solo,
                                          IntFunction<String> withBots,
                                          BiFunction<Integer, Integer, String> summary) {

        public static LobbyDescriptionStrings defaults() {
            return new LobbyDescriptionStrings(
                    () -> Internationalization.text("game.lobby.table.solo"),
                    bots -> Internationalization.text("game.lobby.table.withbots", bots),
                    (humans, bots) -> Internationalization.text("game.lobby.table.summary", humans, bots));
        }
    }

    protected interface AutoRefreshStrategy<S> {
        boolean shouldAutoRefresh(S session);

        default long intervalMs() {
            return 1500L;
        }
    }
}
