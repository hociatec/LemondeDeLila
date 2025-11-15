package com.lemondelila.client.game.view;

import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.game.controller.GameInteractionController;

import javax.swing.JPanel;

public abstract class AbstractGameScreen extends JPanel implements Screen {

    private final ScreenId id;
    private GameInteractionController interactionController;
    private ScreenManager screenManager;

    protected AbstractGameScreen(ScreenId id, GameInteractionController interactionController) {
        this.id = id;
        this.interactionController = interactionController;
    }

    @Override
    public ScreenId id() {
        return id;
    }

    public ScreenManager screenManager() {
        return screenManager;
    }

    @Override
    public void onShow(ScreenContext context) {
        this.screenManager = context.screenManager();
        if (interactionController != null) {
            interactionController.setEnabled(true);
        }
    }

    @Override
    public void onHide(ScreenContext context) {
        this.screenManager = null;
        if (interactionController != null) {
            interactionController.setEnabled(false);
        }
    }

    protected void applyResult(ControllerResult result) {
        if (result == null) {
            return;
        }
        result.statusMessage().ifPresent(this::setStatusMessage);
        result.navigationTarget().ifPresent(this::navigate);
    }

    protected void navigate(ScreenId target) {
        ScreenManager manager = this.screenManager;
        if (manager != null && target != null) {
            manager.show(target);
        }
    }

    protected void setStatusMessage(String message) {
        // default no-op; concrete screens can override to update their status UI
    }

    protected void bindInteractionController(GameInteractionController controller) {
        this.interactionController = controller;
    }
}
