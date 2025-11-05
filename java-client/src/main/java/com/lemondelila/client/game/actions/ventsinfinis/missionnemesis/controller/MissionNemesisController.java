package com.lemondelila.client.game.actions.ventsinfinis.missionnemesis.controller;

import com.lemondelila.client.game.actions.ventsinfinis.missionnemesis.model.MissionNemesisState;
import com.lemondelila.client.game.actions.ventsinfinis.missionnemesis.service.MissionNemesisClient;
import com.lemondelila.client.game.actions.ventsinfinis.missionnemesis.view.SwingMissionNemesisView;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MissionNemesisController implements ActionListener {

    private final SwingMissionNemesisView view;
    private final MissionNemesisClient client;
    private final String roomId;
    private MissionNemesisState model;
    private List<Map<String, Object>> shipsToPlace = new ArrayList<>();
    private String selectedShipName;

    public MissionNemesisController(SwingMissionNemesisView view, MissionNemesisClient client, String roomId) {
        this.view = view;
        this.client = client;
        this.roomId = roomId;

        view.addGridListener(this);
        view.addPlacementListener(this);
        view.addDeployListener(this);
        view.addShipSelectionListener(this);

        client.connect(roomId, this::updateModel);

        try {
            model = client.getState(roomId);
            view.update(model);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void updateModel(MissionNemesisState model) {
        this.model = model;
        view.update(model);
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        String command = e.getActionCommand();
        if (command.contains(",")) {
            String[] parts = command.split(",");
            int x = Integer.parseInt(parts[0]);
            int y = Integer.parseInt(parts[1]);

            if (model.getStatus().equals("placement")) {
                for (Map<String, Object> ship : shipsToPlace) {
                    if (ship.get("name").equals(selectedShipName)) {
                        ((List<Map<String, Integer>>) ship.get("coords")).add(Map.of("x", x, "y", y));
                        break;
                    }
                }
            } else if (model.getStatus().equals("playing")) {
                try {
                    model = client.fireShot(roomId, x, y);
                    view.update(model);
                } catch (Exception ex) {
                    ex.printStackTrace();
                }
            }
        } else if (command.equals("Deploy")) {
            try {
                Map<String, Object> payload = new HashMap<>();
                payload.put("action", "place_ships");
                payload.put("ships", shipsToPlace);
                model = client.placeShips(roomId, payload);
                view.update(model);
            } catch (Exception ex) {
                ex.printStackTrace();
            }
        } else {
            selectedShipName = command;
            boolean shipExists = false;
            for (Map<String, Object> ship : shipsToPlace) {
                if (ship.get("name").equals(selectedShipName)) {
                    shipExists = true;
                    break;
                }
            }
            if (!shipExists) {
                Map<String, Object> newShip = new HashMap<>();
                newShip.put("name", selectedShipName);
                newShip.put("coords", new ArrayList<Map<String, Integer>>());
                shipsToPlace.add(newShip);
            }
        }
    }
}
