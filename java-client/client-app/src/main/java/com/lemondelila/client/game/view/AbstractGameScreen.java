package com.lemondelila.client.game.view;

import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.game.controller.GameActionState;

import javax.swing.JPanel;

public abstract class AbstractGameScreen extends JPanel implements Screen {

    private final ScreenId id;
    private ScreenManager screenManager;
    private GameActionState gameActionState;

    protected AbstractGameScreen(ScreenId id, GameActionState actionState) {
        this.id = id;
        this.gameActionState = actionState;
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
        if (gameActionState != null) {
            gameActionState.setEnabled(true);
        }
    }

    @Override
    public void onHide(ScreenContext context) {
        this.screenManager = null;
        if (gameActionState != null) {
            gameActionState.setEnabled(false);
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

    protected GameActionState ensureGameActionState() {
        if (gameActionState == null) {
            gameActionState = new GameActionState();
        }
        return gameActionState;
    }

    protected void bindGameActionState(GameActionState actionState) {
        this.gameActionState = actionState;
    }
}
