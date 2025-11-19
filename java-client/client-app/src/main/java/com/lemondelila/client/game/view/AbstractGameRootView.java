package com.lemondelila.client.game.view;

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
import com.lemondelila.client.game.view.GameScreenScaffold;

import javax.swing.JComponent;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import java.awt.BorderLayout;
import com.lemondelila.client.framework.access.game.GameHistoryTracker;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
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
        configureShortcuts(binder);
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
    }

    private void handleSession(S session) {
        S previous = this.currentSession;
        if (session == null) {
            this.currentSession = null;
            onSessionCleared(previous);
            return;
        }
        this.currentSession = session;
        if (isNewRoom(previous, session)) {
            onSessionSwitched(previous, session);
        }
        renderSession(session);
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

    protected void configureScaffold(GameScreenScaffold.Builder builder) {
        // hook for subclasses
    }

    protected void configureShortcuts(ShortcutBinder binder) {
        // hook for subclasses
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
        panel.updateHistory(new GameHistoryTracker(), texts.emptyHistoryText());
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

    protected abstract void renderSession(S session);

    protected abstract void onPrimaryAction();

    protected abstract void focusHistoryArea();

    protected abstract void focusMainArea();

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
}
