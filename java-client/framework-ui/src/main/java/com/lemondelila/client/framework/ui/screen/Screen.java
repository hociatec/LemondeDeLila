package com.lemondelila.client.framework.ui.screen;

import javax.swing.JComponent;

public interface Screen {
    ScreenId id();
    JComponent getComponent();
    default void onShow(ScreenContext context) {
        // no-op
    }
    default void onHide(ScreenContext context) {
        // no-op
    }
}

