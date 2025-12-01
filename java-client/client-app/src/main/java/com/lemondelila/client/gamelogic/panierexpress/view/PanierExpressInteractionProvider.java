package com.lemondelila.client.gamelogic.panierexpress.view;

import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.game.core.controller.GameInteractionProvider;
import com.lemondelila.client.game.core.controller.GenericGameInteractionController;
import com.lemondelila.client.game.core.model.ActionRequest;
import com.lemondelila.client.game.core.model.PrimaryActionDescriptor;
import com.lemondelila.client.game.core.service.GameInteractionRegistry;
import com.lemondelila.client.game.core.service.GameStateService;
import com.lemondelila.client.game.core.view.GameInteractionComponent;
import com.lemondelila.client.game.core.view.GenericGameInteractionComponent;
import com.lemondelila.client.game.exchange.controller.ExchangeController;
import com.lemondelila.client.game.exchange.model.ExchangeCollection;
import com.lemondelila.client.game.exchange.model.ExchangePrompt;
import com.lemondelila.client.game.exchange.view.ExchangeView;
import com.lemondelila.client.game.history.controller.GameHistoryController;
import com.lemondelila.client.game.history.service.GameActionEmitter;
import com.lemondelila.client.game.history.service.GameAnnouncer;
import com.lemondelila.client.game.history.view.GameHistorySidebar;
import com.lemondelila.client.game.quiz.view.GameQuizComponentFactory;
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.game.room.service.GameLaunchCoordinator;
import com.lemondelila.client.gamelogic.panierexpress.PanierExpressGameModule;
import com.lemondelila.client.user.model.ClientSession;

import java.util.Optional;

public final class PanierExpressInteractionProvider implements GameInteractionProvider {

    private final GameStateService states;
    private final GameAnnouncer announcer;
    private final GameHistoryController history;
    private final GameHistorySidebar historySidebar;
    private final FocusHighlighter focusHighlighter;
    private final Optional<GameQuizComponentFactory> quizFactory;
    private final TaskScheduler scheduler;
    private final TableState tableState;
    private final GameLaunchCoordinator launchCoordinator;
    private final GameInteractionRegistry registry;
    private final ClientSession session;

    @Inject
    public PanierExpressInteractionProvider(GameStateService states,
                                            GameAnnouncer announcer,
                                            GameHistoryController history,
                                            GameHistorySidebar historySidebar,
                                            FocusHighlighter focusHighlighter,
                                            Optional<GameQuizComponentFactory> quizFactory,
                                            TaskScheduler scheduler,
                                            TableState tableState,
                                            GameLaunchCoordinator launchCoordinator,
                                            GameInteractionRegistry registry,
                                            ClientSession session) {
        this.states = states;
        this.announcer = announcer;
        this.history = history;
        this.historySidebar = historySidebar;
        this.focusHighlighter = focusHighlighter;
        this.quizFactory = quizFactory == null ? Optional.empty() : quizFactory;
        this.scheduler = scheduler;
        this.tableState = tableState;
        this.launchCoordinator = launchCoordinator;
        this.registry = registry;
        this.session = session;
        registry.register(this);
    }

    @Override
    public String gameType() {
        return PanierExpressGameModule.GAME_TYPE;
    }

    @Override
    public GameInteractionComponent create() {
        PrimaryActionDescriptor primary = new PrimaryActionDescriptor(
                "Lancer le de",
                ActionRequest.of("ROLL_DICE", java.util.Map.of(
                        "config", java.util.Map.of(
                                "diceCount", 1,
                                "faces", 6,
                                "modifier", 0
                        )
                ))
        );
        GenericGameInteractionController controller = new GenericGameInteractionController(
                PanierExpressGameModule.GAME_TYPE,
                states,
                primary,
                scheduler,
                tableState,
                2
        );
        GameActionEmitter actionEmitter = new GameActionEmitter(announcer, historySidebar);
        Runnable startHandler = () -> {
            Integer roomId = tableState.roomId();
            if (roomId == null) {
                announcer.announce(historySidebar, "Aucune table selectionnee pour demarrer le jeu.");
                return;
            }
            boolean dispatched = launchCoordinator.launch(roomId, PanierExpressGameModule.GAME_TYPE);
            if (!dispatched) {
                announcer.announce(historySidebar, "Lancement de partie impossible : identifiant de table invalide.");
                return;
            }
        };

        ExchangeCollection exchangeCollection = new ExchangeCollection();
        ExchangeController exchangeController = new ExchangeController(exchangeCollection,
                (prompt, cardId, targetId) -> submitExchange(controller, prompt, cardId, targetId));
        ExchangeView exchangeView = new ExchangeView(exchangeController);

        GenericGameInteractionComponent baseComponent = new GenericGameInteractionComponent(controller,
                actionEmitter,
                history,
                tableState,
                focusHighlighter,
                quizFactory,
                primary,
                startHandler);

        return new PanierExpressGameComponent(baseComponent, controller, exchangeController, exchangeView, session);
    }

    private void submitExchange(GenericGameInteractionController controller,
                                ExchangePrompt prompt,
                                String cardId,
                                String targetId) {
        if (prompt == null || cardId == null || cardId.isBlank()) {
            return;
        }
        java.util.Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("exchangeId", prompt.exchangeId());
        payload.put("card", cardId);
        if (prompt.stage() == ExchangePrompt.Stage.SELECT) {
            if (targetId == null || targetId.isBlank()) {
                return;
            }
        } else if (targetId == null || targetId.isBlank()) {
            targetId = prompt.actingPlayerId();
        }
        payload.put("targetId", targetId);
        controller.sendActions(java.util.List.of(
                ActionRequest.of("apply_exchange", payload)
        ));
    }
}
