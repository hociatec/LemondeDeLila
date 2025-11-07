package com.lemondelila.client.gamelogic.missionnemesis.view;

import javax.swing.BorderFactory;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import java.awt.Dimension;

final class NemesisLogPanel extends JScrollPane {

    private final JTextArea logArea = new JTextArea();

    NemesisLogPanel() {
        logArea.setEditable(false);
        logArea.setLineWrap(true);
        logArea.setWrapStyleWord(true);
        setViewportView(logArea);
        setBorder(BorderFactory.createTitledBorder("Journal des actions"));
        setPreferredSize(new Dimension(0, 160));
    }

    void showLog(String content) {
        logArea.setText(content);
        logArea.setCaretPosition(logArea.getDocument().getLength());
    }

    void clear() {
        logArea.setText("");
    }
}

