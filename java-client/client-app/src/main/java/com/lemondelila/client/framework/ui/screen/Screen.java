package com.lemondelila.client.framework.ui.screen;

import javax.swing.JComponent;

public interface Screen {
    String id();
    JComponent getComponent();
    default void onShow(ScreenContext context) {
        // no-op
    }
    default void onHide(ScreenContext context) {
        // no-op
    }
}

