package com.lemondelila.client.gamelogic.damenature.view;

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
import com.lemondelila.client.game.history.controller.GameHistoryController;
import com.lemondelila.client.game.history.service.GameActionEmitter;
import com.lemondelila.client.game.history.service.GameAnnouncer;
import com.lemondelila.client.game.history.view.GameHistorySidebar;
import com.lemondelila.client.game.quiz.view.GameQuizComponentFactory;
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.game.room.service.GameLaunchCoordinator;
import com.lemondelila.client.gamelogic.damenature.DameNatureGameModule;
import com.lemondelila.client.gamelogic.damenature.service.DameNatureConfigState;
import com.lemondelila.client.user.model.ClientSession;

import java.util.Optional;

public final class DameNatureInteractionProvider implements GameInteractionProvider {

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
    private final DameNatureConfigState configState;

    @Inject
    public DameNatureInteractionProvider(GameStateService states,
                                         GameAnnouncer announcer,
                                         GameHistoryController history,
                                         GameHistorySidebar historySidebar,
                                         FocusHighlighter focusHighlighter,
                                         Optional<GameQuizComponentFactory> quizFactory,
                                         TaskScheduler scheduler,
                                         TableState tableState,
                                         GameLaunchCoordinator launchCoordinator,
                                         GameInteractionRegistry registry,
                                         ClientSession session,
                                         DameNatureConfigState configState) {
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
        this.configState = configState;
        registry.register(this);
    }

    @Override
    public String gameType() {
        return DameNatureGameModule.GAME_TYPE;
    }

    @Override
    public GameInteractionComponent create() {
        PrimaryActionDescriptor primary = new PrimaryActionDescriptor(
                "Piocher une carte",
                ActionRequest.of("draw")
        );
        GenericGameInteractionController controller = new GenericGameInteractionController(
                DameNatureGameModule.GAME_TYPE,
                states,
                primary,
                scheduler,
                tableState,
                2
        );
        GameActionEmitter emitter = new GameActionEmitter(announcer, historySidebar);
        Runnable startHandler = () -> {
            Integer roomId = tableState.roomId();
            if (roomId == null) {
                announcer.announce(historySidebar, "Aucune table sélectionnée.");
                return;
            }
            boolean dispatched = launchCoordinator.launch(roomId, DameNatureGameModule.GAME_TYPE);
            if (!dispatched) {
                announcer.announce(historySidebar, "Impossible de démarrer la partie.");
            }
        };

        GenericGameInteractionComponent base = new GenericGameInteractionComponent(
                controller,
                emitter,
                history,
                tableState,
                focusHighlighter,
                quizFactory,
                primary,
                startHandler
        );

        return new DameNatureGameComponent(base, controller, emitter, session, configState);
    }
}
