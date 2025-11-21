package com.lemondelila.client.gamelogic.panierexpress.view;

import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.game.core.GameAnnouncer;
import com.lemondelila.client.game.core.GameInteractionComponent;
import com.lemondelila.client.game.core.GameInteractionProvider;
import com.lemondelila.client.game.history.controller.GameHistoryController;
import com.lemondelila.client.game.history.view.GameHistorySidebar;
import com.lemondelila.client.gamelogic.panierexpress.PanierExpressGameModule;
import com.lemondelila.client.gamelogic.panierexpress.controller.PanierExpressInteractionController;
import com.lemondelila.client.gamelogic.panierexpress.service.PanierExpressApiService;
import com.lemondelila.client.framework.core.task.TaskScheduler;

public final class PanierExpressInteractionProvider implements GameInteractionProvider {

    private final PanierExpressApiService api;
    private final TaskScheduler scheduler;
    private final GameAnnouncer announcer;
    private final GameHistoryController history;
    private final FocusHighlighter focusHighlighter;
    private final GameHistorySidebar historySidebar;

    @Inject
    public PanierExpressInteractionProvider(PanierExpressApiService api,
                                            TaskScheduler scheduler,
                                            GameAnnouncer announcer,
                                            GameHistoryController history,
                                            GameHistorySidebar historySidebar,
                                            FocusHighlighter focusHighlighter) {
        this.api = api;
        this.scheduler = scheduler;
        this.announcer = announcer;
        this.history = history;
        this.historySidebar = historySidebar;
        this.focusHighlighter = focusHighlighter;
    }

    @Override
    public String gameType() {
        return PanierExpressGameModule.GAME_TYPE;
    }

    @Override
    public GameInteractionComponent create() {
        PanierExpressInteractionController controller = new PanierExpressInteractionController(api, scheduler);
        return new PanierExpressInteractionComponent(controller, announcer, history, historySidebar, focusHighlighter);
    }
}
