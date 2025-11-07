package com.lemondelila.client.gamelogic.missionnemesis.view;

import com.lemondelila.client.gamelogic.missionnemesis.model.GridCoordinate;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSession;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSpecs;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisState;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JPanel;
import javax.swing.border.TitledBorder;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.GridLayout;
import java.awt.Insets;
import java.util.List;
import java.util.function.Consumer;

final class NemesisGridPanel extends JPanel {

    private static final int BOARD_SIZE = NemesisSpecs.BOARD_SIZE;
    private static final Color WATER = new Color(36, 56, 78);
    private static final Color SHIP = new Color(75, 98, 120);
    private static final Color HIT = new Color(182, 55, 62);
    private static final Color SUNK = new Color(126, 35, 52);
    private static final Color MISS = new Color(96, 108, 118);
    private static final Color ENEMY_READY = new Color(62, 88, 112);

    private final boolean ownsFleet;
    private final CellButton[][] cells;
    private final Consumer<GridCoordinate> fireHandler;

    NemesisGridPanel(boolean ownsFleet, Consumer<GridCoordinate> fireHandler) {
        this.ownsFleet = ownsFleet;
        this.fireHandler = fireHandler;
        this.cells = new CellButton[BOARD_SIZE][BOARD_SIZE];
        buildUi(ownsFleet ? "Votre flotte" : "Zone ennemie");
    }

    void renderOwn(NemesisSession session) {
        clear();
        session.self().ifPresent(self -> {
            for (NemesisState.Ship ship : self.ships()) {
                List<NemesisState.Coordinate> coords = ship.coordinates();
                for (int i = 0; i < coords.size(); i++) {
                    NemesisState.Coordinate coord = coords.get(i);
                    CellButton cell = cells[coord.x()][coord.y()];
                    cell.button().setBackground(SHIP);
                    if (ship.hits()[i]) {
                        markHit(cell);
                    }
                }
            }
            for (NemesisState.Player opponent : session.opponents()) {
                for (NemesisState.Shot shot : opponent.shots()) {
                    if (shot.targetId() == self.id()) {
                        CellButton cell = cells[shot.x()][shot.y()];
                        switch (shot.result()) {
                            case "hit" -> markHit(cell);
                            case "sunk" -> markSunk(cell);
                            default -> markMiss(cell);
                        }
                    }
                }
            }
        });
    }

    void renderEnemy(NemesisSession session) {
        clear();
        session.self().ifPresent(self -> {
            for (NemesisState.Shot shot : self.shots()) {
                CellButton cell = cells[shot.x()][shot.y()];
                switch (shot.result()) {
                    case "hit" -> markHit(cell);
                    case "sunk" -> markSunk(cell);
                    case "miss" -> markMiss(cell);
                    default -> prepare(cell);
                }
                cell.button().setEnabled(false);
            }
        });
    }

    void setFiringEnabled(boolean enabled, NemesisSession session) {
        if (ownsFleet) {
            return;
        }
        boolean[][] alreadyShot = new boolean[BOARD_SIZE][BOARD_SIZE];
        session.self().ifPresent(self -> self.shots().forEach(shot -> alreadyShot[shot.x()][shot.y()] = true));
        for (int y = 0; y < BOARD_SIZE; y++) {
            for (int x = 0; x < BOARD_SIZE; x++) {
                JButton button = cells[x][y].button();
                if (alreadyShot[x][y] || session.finished()) {
                    button.setEnabled(false);
                } else {
                    button.setEnabled(enabled);
                    prepare(cells[x][y]);
                }
            }
        }
    }

    void clear() {
        for (int y = 0; y < BOARD_SIZE; y++) {
            for (int x = 0; x < BOARD_SIZE; x++) {
                JButton button = cells[x][y].button();
                button.setBackground(WATER);
                button.setText("");
                button.setEnabled(false);
            }
        }
    }

    private void buildUi(String title) {
        setLayout(new BorderLayout());
        JPanel grid = new JPanel(new GridLayout(BOARD_SIZE, BOARD_SIZE, 1, 1));
        grid.setBorder(BorderFactory.createCompoundBorder(
                new TitledBorder(title),
                BorderFactory.createEmptyBorder(8, 8, 8, 8)
        ));
        for (int y = 0; y < BOARD_SIZE; y++) {
            for (int x = 0; x < BOARD_SIZE; x++) {
                JButton button = new JButton();
                button.setMargin(new Insets(0, 0, 0, 0));
                button.setOpaque(true);
                button.setFocusPainted(false);
                button.setPreferredSize(new Dimension(32, 32));
                int coordX = x;
                int coordY = y;
                if (!ownsFleet) {
                    button.addActionListener(e -> fireHandler.accept(new GridCoordinate(coordX, coordY)));
                }
                cells[x][y] = new CellButton(button, coordX, coordY);
                grid.add(button);
            }
        }
        add(grid, BorderLayout.CENTER);
    }

    private void markHit(CellButton cell) {
        cell.button().setBackground(HIT);
        cell.button().setText("X");
    }

    private void markSunk(CellButton cell) {
        cell.button().setBackground(SUNK);
        cell.button().setText("X");
    }

    private void markMiss(CellButton cell) {
        cell.button().setBackground(MISS);
        cell.button().setText("o");
    }

    private void prepare(CellButton cell) {
        cell.button().setBackground(ENEMY_READY);
        cell.button().setText("");
    }

    private record CellButton(JButton button, int x, int y) {
    }
}

