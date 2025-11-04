package com.lemondelila.client.game.view;

import com.lemondelila.client.session.service.SessionService;
import com.lemondelila.client.ui.SwingAuthView;
import org.json.JSONArray;
import org.json.JSONObject;

import javax.swing.*;
import java.awt.*;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Timer;
import java.util.TimerTask;
import java.util.stream.Collectors;

public class SwingMissionNemesisView extends JPanel {

    private final JLabel statusLabel = new JLabel("Place your ships!", SwingConstants.CENTER);
    private final JButton[][] playerGrid = new JButton[10][10];
    private final JButton[][] opponentGrid = new JButton[10][10];
    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final String roomId;
    private final SwingAuthView authView;
    private final int myPlayerIndex;
    private final SessionService sessionService;
    private final URI apiBaseUri;
    private final List<Ship> shipsToPlace = new ArrayList<>();
    private final List<Ship> placedShips = new ArrayList<>();
    private Ship selectedShip;
    private Timer pollingTimer;

    private static class Ship {
        String name;
        int size;
        List<Point> coords = new ArrayList<>();

        Ship(String name, int size) {
            this.name = name;
            this.size = size;
        }
    }

    public SwingMissionNemesisView(SwingAuthView authView, String roomId, int myPlayerIndex, SessionService sessionService, URI apiBaseUri) {
        this.authView = authView;
        this.roomId = roomId;
        this.myPlayerIndex = myPlayerIndex;
        this.sessionService = sessionService;
        this.apiBaseUri = apiBaseUri;
        setLayout(new BorderLayout());

        shipsToPlace.add(new Ship("Station spatiale", 5));
        shipsToPlace.add(new Ship("Trou noir stabilisé", 4));
        shipsToPlace.add(new Ship("Astéroïde", 3));
        shipsToPlace.add(new Ship("Satellite", 3));
        shipsToPlace.add(new Ship("Sonde", 2));
        selectedShip = shipsToPlace.get(0);

        JPanel headerPanel = new JPanel(new FlowLayout(FlowLayout.CENTER));
        headerPanel.add(statusLabel);
        add(headerPanel, BorderLayout.NORTH);

        JPanel gridsPanel = new JPanel(new GridLayout(1, 2, 20, 0));
        gridsPanel.add(createGridPanel("Your Grid", playerGrid, false));
        gridsPanel.add(createGridPanel("Opponent's Grid", opponentGrid, true));
        add(gridsPanel, BorderLayout.CENTER);

        JPanel placementPanel = new JPanel();
        placementPanel.setLayout(new BoxLayout(placementPanel, BoxLayout.Y_AXIS));
        for (Ship ship : shipsToPlace) {
            JButton shipButton = new JButton(ship.name);
            shipButton.addActionListener(e -> selectedShip = ship);
            placementPanel.add(shipButton);
        }
        JButton deployButton = new JButton("Deploy");
        deployButton.addActionListener(e -> deployShips());
        placementPanel.add(deployButton);
        add(placementPanel, BorderLayout.EAST);


        addAncestorListener(new javax.swing.event.AncestorListener() {
            public void ancestorAdded(javax.swing.event.AncestorEvent event) {
                authView.shortcuts().setF1Action(() -> {
                    RulesDialog dialog = new RulesDialog(authView, "mission-nemesis", apiBaseUri);
                    dialog.setVisible(true);
                });
                startPolling();
            }

            public void ancestorRemoved(javax.swing.event.AncestorEvent event) {
                authView.shortcuts().setF1Action(null);
                stopPolling();
            }

            public void ancestorMoved(javax.swing.event.AncestorEvent event) {
            }
        });
    }

    private JPanel createGridPanel(String title, JButton[][] grid, boolean isOpponentGrid) {
        JPanel panel = new JPanel(new BorderLayout());
        panel.setBorder(BorderFactory.createTitledBorder(title));

        JPanel gridPanel = new JPanel(new GridLayout(10, 10));
        for (int i = 0; i < 10; i++) {
            for (int j = 0; j < 10; j++) {
                grid[i][j] = new JButton();
                grid[i][j].setPreferredSize(new Dimension(30, 30));
                if (isOpponentGrid) {
                    int finalI = i;
                    int finalJ = j;
                    grid[i][j].addActionListener(e -> fireShot(finalI, finalJ));
                } else {
                    int finalI = i;
                    int finalJ = j;
                    grid[i][j].addActionListener(e -> placeShip(finalI, finalJ));
                }
                gridPanel.add(grid[i][j]);
            }
        }
        panel.add(gridPanel, BorderLayout.CENTER);
        return panel;
    }

    private void startPolling() {
        pollingTimer = new Timer();
        pollingTimer.schedule(new TimerTask() {
            @Override
            public void run() {
                fetchGameState();
            }
        }, 0, 2000); // Poll every 2 seconds
    }

    private void stopPolling() {
        if (pollingTimer != null) {
            pollingTimer.cancel();
        }
    }

    private void fetchGameState() {
        new SwingWorker<String, Void>() {
            @Override
            protected String doInBackground() throws Exception {
                HttpRequest.Builder builder = HttpRequest.newBuilder()
                        .uri(apiBaseUri.resolve("games/mission-nemesis/rooms/" + roomId + "/state"))
                        .header("Content-Type", "application/json");
                sessionService.token().ifPresent(token -> builder.header("Authorization", "Bearer " + token));
                HttpRequest request = builder.GET().build();
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                return response.body();
            }

            @Override
            protected void done() {
                try {
                    String responseBody = get();
                    updateUIFromState(new JSONObject(responseBody));
                } catch (Exception e) {
                    e.printStackTrace();
                    statusLabel.setText("Error: " + e.getMessage());
                }
            }
        }.execute();
    }

    private void placeShip(int x, int y) {
        if (selectedShip != null && selectedShip.coords.size() < selectedShip.size) {
            Point newPoint = new Point(x, y);
            List<Point> newCoords = new ArrayList<>(selectedShip.coords);
            newCoords.add(newPoint);
            if (isValidPlacement(newCoords)) {
                selectedShip.coords.add(newPoint);
                playerGrid[x][y].setBackground(Color.GREEN);
                playerGrid[x][y].setEnabled(false);
                if (selectedShip.coords.size() == selectedShip.size) {
                    placedShips.add(selectedShip);
                    shipsToPlace.remove(selectedShip);
                    if (!shipsToPlace.isEmpty()) {
                        selectedShip = shipsToPlace.get(0);
                    } else {
                        selectedShip = null;
                    }
                }
            }
        }
    }

    private boolean isValidPlacement(List<Point> coords) {
        if (coords.size() <= 1) {
            return true;
        }

        coords.sort((p1, p2) -> p1.x != p2.x ? Integer.compare(p1.x, p2.x) : Integer.compare(p1.y, p2.y));

        boolean isHorizontal = coords.stream().allMatch(p -> p.y == coords.get(0).y);
        boolean isVertical = coords.stream().allMatch(p -> p.x == coords.get(0).x);

        if (!isHorizontal && !isVertical) {
            return false;
        }

        for (int i = 0; i < coords.size() - 1; i++) {
            if (isHorizontal) {
                if (coords.get(i+1).x - coords.get(i).x != 1) {
                    return false;
                }
            } else {
                if (coords.get(i+1).y - coords.get(i).y != 1) {
                    return false;
                }
            }
        }

        return true;
    }

    private void deployShips() {
        new SwingWorker<String, Void>() {
            @Override
            protected String doInBackground() throws Exception {
                JSONObject payload = new JSONObject();
                payload.put("action", "place_ships");
                JSONArray shipsJson = new JSONArray();
                for (Ship ship : placedShips) {
                    JSONObject shipJson = new JSONObject();
                    shipJson.put("name", ship.name);
                    JSONArray coordsJson = new JSONArray();
                    for (Point coord : ship.coords) {
                        JSONObject coordJson = new JSONObject();
                        coordJson.put("x", coord.x);
                        coordJson.put("y", coord.y);
                        coordsJson.put(coordJson);
                    }
                    shipJson.put("coords", coordsJson);
                    shipsJson.put(shipJson);
                }
                payload.put("ships", shipsJson);

                HttpRequest.Builder builder = HttpRequest.newBuilder()
                        .uri(apiBaseUri.resolve("games/mission-nemesis/rooms/" + roomId + "/move"))
                        .header("Content-Type", "application/json");
                sessionService.token().ifPresent(token -> builder.header("Authorization", "Bearer " + token));
                HttpRequest request = builder.POST(HttpRequest.BodyPublishers.ofString(payload.toString(), StandardCharsets.UTF_8)).build();
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                return response.body();
            }

            @Override
            protected void done() {
                try {
                    String responseBody = get();
                    updateUIFromState(new JSONObject(responseBody));
                } catch (Exception e) {
                    e.printStackTrace();
                    statusLabel.setText("Error: " + e.getMessage());
                }
            }
        }.execute();
    }


    private void fireShot(int x, int y) {
        new SwingWorker<String, Void>() {
            @Override
            protected String doInBackground() throws Exception {
                JSONObject payload = new JSONObject();
                payload.put("action", "fire");
                JSONObject coordinates = new JSONObject();
                coordinates.put("x", x);
                coordinates.put("y", y);
                payload.put("coordinates", coordinates);

                HttpRequest.Builder builder = HttpRequest.newBuilder()
                        .uri(apiBaseUri.resolve("games/mission-nemesis/rooms/" + roomId + "/move"))
                        .header("Content-Type", "application/json");
                sessionService.token().ifPresent(token -> builder.header("Authorization", "Bearer " + token));
                HttpRequest request = builder.POST(HttpRequest.BodyPublishers.ofString(payload.toString(), StandardCharsets.UTF_8)).build();
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                return response.body();
            }

            @Override
            protected void done() {
                try {
                    String responseBody = get();
                    updateUIFromState(new JSONObject(responseBody));
                } catch (Exception e) {
                    e.printStackTrace();
                    statusLabel.setText("Error: " + e.getMessage());
                }
            }
        }.execute();
    }

    private void updateUIFromState(JSONObject state) {
        String status = state.getString("status");
        if (status.equals("ended")) {
            int winnerId = state.getInt("winner");
            statusLabel.setText("Player " + winnerId + " wins!");
            stopPolling();
            return;
        }

        int turnIndex = state.getInt("turnIndex");
        if (turnIndex == myPlayerIndex) {
            statusLabel.setText("Your turn");
        } else {
            statusLabel.setText("Opponent's turn");
        }

        JSONArray players = state.getJSONArray("players");
        JSONObject myPlayer = players.getJSONObject(myPlayerIndex);
        JSONArray myShips = myPlayer.getJSONArray("ships");
        for (int i = 0; i < myShips.length(); i++) {
            JSONObject ship = myShips.getJSONObject(i);
            JSONArray coords = ship.getJSONArray("coords");
            JSONArray hits = ship.getJSONArray("hits");
            for (int j = 0; j < coords.length(); j++) {
                JSONObject coord = coords.getJSONObject(j);
                int x = coord.getInt("x");
                int y = coord.getInt("y");
                playerGrid[x][y].setBackground(Color.GREEN);
                if (hits.getBoolean(j)) {
                    playerGrid[x][y].setBackground(Color.ORANGE);
                }
            }
        }

        int opponentIndex = (myPlayerIndex + 1) % 2;
        JSONObject opponent = players.getJSONObject(opponentIndex);
        JSONArray opponentShots = opponent.getJSONArray("shots");
        for (int i = 0; i < opponentShots.length(); i++) {
            JSONObject shot = opponentShots.getJSONObject(i);
            int x = shot.getInt("x");
            int y = shot.getInt("y");
            if (shot.getBoolean("hit")) {
                playerGrid[x][y].setBackground(Color.RED);
            } else {
                playerGrid[x][y].setText("X");
            }
        }

        JSONArray myShots = myPlayer.getJSONArray("shots");
        for (int i = 0; i < myShots.length(); i++) {
            JSONObject shot = myShots.getJSONObject(i);
            int x = shot.getInt("x");
            int y = shot.getInt("y");
            boolean hit = shot.getBoolean("hit");
            if (hit) {
                opponentGrid[x][y].setBackground(Color.RED);
            } else {
                opponentGrid[x][y].setBackground(Color.BLUE);
            }
            opponentGrid[x][y].setEnabled(false);
        }
    }
}
