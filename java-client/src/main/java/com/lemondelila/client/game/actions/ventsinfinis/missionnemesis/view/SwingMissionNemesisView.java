package com.lemondelila.client.game.actions.ventsinfinis.missionnemesis.view;

import com.lemondelila.client.game.actions.ventsinfinis.missionnemesis.model.MissionNemesisState;
import com.lemondelila.client.game.actions.ventsinfinis.missionnemesis.model.MissionNemesisState.PlayerState;
import com.lemondelila.client.game.actions.ventsinfinis.missionnemesis.model.MissionNemesisState.ShipState;
import com.lemondelila.client.game.actions.ventsinfinis.missionnemesis.model.MissionNemesisState.ShotState;
import com.lemondelila.client.game.actions.ventsinfinis.missionnemesis.model.MissionNemesisState.CoordState;

import javax.swing.*;
import java.awt.*;
import java.awt.event.ActionListener;
import java.util.List;

public class SwingMissionNemesisView extends JPanel {

    private final JLabel statusLabel = new JLabel("Place your ships!", SwingConstants.CENTER);
    private final JButton[][] playerGrid = new JButton[10][10];
    private final JButton[][] opponentGrid = new JButton[10][10];
    private final JButton deployButton = new JButton("Deploy");
    private final JPanel placementPanel = new JPanel();

    public SwingMissionNemesisView() {
        setLayout(new BorderLayout());

        JPanel headerPanel = new JPanel(new FlowLayout(FlowLayout.CENTER));
        headerPanel.add(statusLabel);
        add(headerPanel, BorderLayout.NORTH);

        JPanel gridsPanel = new JPanel(new GridLayout(1, 2, 20, 0));
        gridsPanel.add(createGridPanel("Your Grid", playerGrid, false));
        gridsPanel.add(createGridPanel("Opponent's Grid", opponentGrid, true));
        add(gridsPanel, BorderLayout.CENTER);

        placementPanel.setLayout(new BoxLayout(placementPanel, BoxLayout.Y_AXIS));
        placementPanel.add(deployButton);
        add(placementPanel, BorderLayout.EAST);
    }

    private JPanel createGridPanel(String title, JButton[][] grid, boolean isOpponentGrid) {
        JPanel panel = new JPanel(new BorderLayout());
        panel.setBorder(BorderFactory.createTitledBorder(title));

        JPanel gridPanel = new JPanel(new GridLayout(10, 10));
        for (int i = 0; i < 10; i++) {
            for (int j = 0; j < 10; j++) {
                grid[i][j] = new JButton();
                grid[i][j].setPreferredSize(new Dimension(30, 30));
                grid[i][j].setActionCommand(i + "," + j);
                gridPanel.add(grid[i][j]);
            }
        }
        panel.add(gridPanel, BorderLayout.CENTER);
        return panel;
    }

    public void addGridListener(ActionListener listener) {
        for (int i = 0; i < 10; i++) {
            for (int j = 0; j < 10; j++) {
                opponentGrid[i][j].addActionListener(listener);
            }
        }
    }

    public void addPlacementListener(ActionListener listener) {
        for (int i = 0; i < 10; i++) {
            for (int j = 0; j < 10; j++) {
                playerGrid[i][j].addActionListener(listener);
            }
        }
    }

    public void addDeployListener(ActionListener listener) {
        deployButton.addActionListener(listener);
    }

    public void addShipSelectionListener(ActionListener listener) {
        for (Component comp : placementPanel.getComponents()) {
            if (comp instanceof JButton && comp != deployButton) {
                ((JButton) comp).addActionListener(listener);
            }
        }
    }

    public void setShipsToPlace(List<String> shipNames) {
        for (Component comp : placementPanel.getComponents()) {
            if (comp instanceof JButton && comp != deployButton) {
                placementPanel.remove(comp);
            }
        }
        for (String shipName : shipNames) {
            JButton shipButton = new JButton(shipName);
            shipButton.setActionCommand(shipName);
            placementPanel.add(shipButton);
        }
        placementPanel.revalidate();
        placementPanel.repaint();
    }

    public void update(MissionNemesisState model) {
        statusLabel.setText(model.getStatus());

        int myPlayerIndex = 0; // TODO: Determine dynamically
        PlayerState myPlayer = model.getPlayers().get(myPlayerIndex);
        PlayerState opponent = model.getPlayers().get((myPlayerIndex + 1) % 2);

        // Update player grid
        for (ShipState ship : myPlayer.getShips()) {
            for (int i = 0; i < ship.getCoords().size(); i++) {
                CoordState coord = ship.getCoords().get(i);
                playerGrid[coord.getX()][coord.getY()].setBackground(Color.GREEN);
                if (ship.getHits().get(i)) {
                    playerGrid[coord.getX()][coord.getY()].setBackground(Color.ORANGE);
                }
            }
        }
        for (ShotState shot : opponent.getShots()) {
            if (shot.isHit()) {
                playerGrid[shot.getX()][shot.getY()].setBackground(Color.RED);
            } else {
                playerGrid[shot.getX()][shot.getY()].setText("X");
            }
        }

        // Update opponent grid
        for (ShotState shot : myPlayer.getShots()) {
            if (shot.isHit()) {
                opponentGrid[shot.getX()][shot.getY()].setBackground(Color.RED);
            } else {
                opponentGrid[shot.getX()][shot.getY()].setBackground(Color.BLUE);
            }
            opponentGrid[shot.getX()][shot.getY()].setEnabled(false);
        }
    }
}
