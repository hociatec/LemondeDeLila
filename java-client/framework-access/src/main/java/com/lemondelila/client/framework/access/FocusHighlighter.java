package com.lemondelila.client.framework.access;

import javax.swing.BorderFactory;
import javax.swing.JComponent;
import java.awt.Insets;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import java.awt.Color;

public final class FocusHighlighter {

    private final Color focusColor;

    public FocusHighlighter() {
        this(new Color(0x3A7AFE));
    }

    public FocusHighlighter(Color focusColor) {
        this.focusColor = focusColor;
    }

    public void apply(JComponent component) {
        Insets insets = new Insets(2, 2, 2, 2);
        var originalBorder = component.getBorder();
        component.addFocusListener(new FocusAdapter() {
            @Override
            public void focusGained(FocusEvent e) {
                component.setBorder(BorderFactory.createCompoundBorder(
                        BorderFactory.createLineBorder(focusColor, 2),
                        BorderFactory.createEmptyBorder(insets.top, insets.left, insets.bottom, insets.right)
                ));
            }

            @Override
            public void focusLost(FocusEvent e) {
                component.setBorder(originalBorder);
            }
        });
    }
}
