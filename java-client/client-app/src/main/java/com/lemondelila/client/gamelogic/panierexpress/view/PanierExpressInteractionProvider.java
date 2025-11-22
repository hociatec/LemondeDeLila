package com.lemondelila.client.gamelogic.panierexpress.view;

import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.game.core.GameActionEmitter;
import com.lemondelila.client.game.core.GameAnnouncer;
import com.lemondelila.client.game.core.GameInteractionComponent;
import com.lemondelila.client.game.core.GameInteractionProvider;
import com.lemondelila.client.game.core.action.ActionRequest;
import com.lemondelila.client.game.core.controller.GenericGameInteractionController;
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.game.core.model.PrimaryActionDescriptor;
import com.lemondelila.client.game.core.service.GameStateService;
import com.lemondelila.client.game.core.view.GenericGameInteractionComponent;
import com.lemondelila.client.game.history.controller.GameHistoryController;
import com.lemondelila.client.game.history.view.GameHistorySidebar;
import com.lemondelila.client.gamelogic.panierexpress.PanierExpressGameModule;

public final class PanierExpressInteractionProvider implements GameInteractionProvider {

    private final GameStateService states;
    private final GameAnnouncer announcer;
    private final GameHistoryController history;
    private final GameHistorySidebar historySidebar;
    private final FocusHighlighter focusHighlighter;
    private final TaskScheduler scheduler;
    private final TableState tableState;

    @Inject
    public PanierExpressInteractionProvider(GameStateService states,
                                            GameAnnouncer announcer,
                                            GameHistoryController history,
                                            GameHistorySidebar historySidebar,
                                            FocusHighlighter focusHighlighter,
                                            TaskScheduler scheduler,
                                            TableState tableState) {
        this.states = states;
        this.announcer = announcer;
        this.history = history;
        this.historySidebar = historySidebar;
        this.focusHighlighter = focusHighlighter;
        this.scheduler = scheduler;
        this.tableState = tableState;
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
        return new GenericGameInteractionComponent(controller,
                new GameActionEmitter(announcer, historySidebar, history),
                history,
                tableState,
                focusHighlighter,
                primary);
    }
}
