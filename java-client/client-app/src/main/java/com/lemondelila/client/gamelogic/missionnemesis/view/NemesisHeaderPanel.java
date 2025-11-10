package com.lemondelila.client.gamelogic.missionnemesis.view;

import javax.swing.BoxLayout;
import javax.swing.JLabel;
import javax.swing.JPanel;
import java.awt.Font;

final class NemesisHeaderPanel extends JPanel {

    NemesisHeaderPanel() {
        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));

        JLabel title = new JLabel("Mission Nemesis");
        title.setFont(title.getFont().deriveFont(Font.BOLD, 26f));
        add(title);

        JLabel subtitle = new JLabel("Configurez la partie au clavier, placez votre flotte puis engagez le combat.");
        subtitle.setFont(subtitle.getFont().deriveFont(Font.ITALIC, 14f));
        add(subtitle);
    }
}
