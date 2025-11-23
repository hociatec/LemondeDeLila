package com.lemondelila.client.gamelogic.panierexpress.view;

import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.game.history.service.GameActionEmitter;
import com.lemondelila.client.game.history.service.GameAnnouncer;
import com.lemondelila.client.game.core.view.GameInteractionComponent;
import com.lemondelila.client.game.core.controller.GameInteractionProvider;
import com.lemondelila.client.game.core.model.ActionRequest;
import com.lemondelila.client.game.core.controller.GenericGameInteractionController;
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.game.core.model.PrimaryActionDescriptor;
import com.lemondelila.client.game.core.service.GameStateService;
import com.lemondelila.client.game.room.view.GenericGameInteractionComponent;
import com.lemondelila.client.game.history.controller.GameHistoryController;
import com.lemondelila.client.game.history.view.GameHistorySidebar;
import com.lemondelila.client.game.room.service.GameLaunchCoordinator;
import com.lemondelila.client.gamelogic.panierexpress.PanierExpressGameModule;

public final class PanierExpressInteractionProvider implements GameInteractionProvider {

    private final GameStateService states;
    private final GameAnnouncer announcer;
    private final GameHistoryController history;
    private final GameHistorySidebar historySidebar;
    private final FocusHighlighter focusHighlighter;
    private final TaskScheduler scheduler;
    private final TableState tableState;
    private final GameLaunchCoordinator launchCoordinator;

    @Inject
    public PanierExpressInteractionProvider(GameStateService states,
                                            GameAnnouncer announcer,
                                            GameHistoryController history,
                                            GameHistorySidebar historySidebar,
                                            FocusHighlighter focusHighlighter,
                                            TaskScheduler scheduler,
                                            TableState tableState,
                                            GameLaunchCoordinator launchCoordinator) {
        this.states = states;
        this.announcer = announcer;
        this.history = history;
        this.historySidebar = historySidebar;
        this.focusHighlighter = focusHighlighter;
        this.scheduler = scheduler;
        this.tableState = tableState;
        this.launchCoordinator = launchCoordinator;
    }

    @Override
    public String gameType() {
        return PanierExpressGameModule.GAME_TYPE;
    }

    @Override
    public GameInteractionComponent create() {
        PrimaryActionDescriptor primary = new PrimaryActionDescriptor(
                "Lancer le dé",
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
                scheduler
        );
        controller.setParticipantGate(() -> (tableState.players().size() + tableState.bots().size()) >= 2);
        Runnable startHandler = () -> {
            Integer roomId = tableState.roomId();
            if (roomId == null) {
                announcer.announce(historySidebar, "Aucune table sélectionnée pour démarrer le jeu.");
                return;
            }
            boolean dispatched = launchCoordinator.launch(roomId, PanierExpressGameModule.GAME_TYPE);
            if (!dispatched) {
                announcer.announce(historySidebar, "Lancement de partie impossible : identifiant de table invalide.");
            }
        };
        return new GenericGameInteractionComponent(controller,
                new GameActionEmitter(announcer, historySidebar, history),
                history,
                tableState,
                focusHighlighter,
                primary,
                startHandler);
    }
}
