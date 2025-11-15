package com.lemondelila.client.gamelogic.missionnemesis.view;

import com.lemondelila.client.gamelogic.missionnemesis.model.GridCoordinate;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSession;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSpecs;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisState;
import com.lemondelila.client.gamelogic.missionnemesis.model.ShipPlacement;

import javax.accessibility.AccessibleContext;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.SwingConstants;
import javax.swing.border.TitledBorder;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.GridLayout;
import java.awt.Insets;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

final class NemesisGridPanel extends JPanel {

    private static final int BOARD_SIZE = NemesisSpecs.BOARD_SIZE;
    private static final Color WATER = new Color(36, 56, 78);
    private static final Color SHIP = new Color(75, 98, 120);
    private static final Color HIT = new Color(182, 55, 62);
    private static final Color SUNK = new Color(126, 35, 52);
    private static final Color MISS = new Color(96, 108, 118);
    private static final Color ENEMY_READY = new Color(62, 88, 112);
    private static final Color CURRENT_PLACEMENT = new Color(110, 144, 188);
    private static final Color SELECTION_BORDER = new Color(255, 215, 99);

    private final boolean ownsFleet;
    private final CellButton[][] cells;
    private final Consumer<GridCoordinate> fireHandler;
    private final JLabel botBadge = new JLabel(" ");
    private final NemesisManualPlacementController manualController = new NemesisManualPlacementController(BOARD_SIZE);
    private final NemesisFireController fireController = new NemesisFireController(BOARD_SIZE);

    private InteractionMode interactionMode = InteractionMode.NONE;
    private Consumer<GridCoordinate> fireSelectionListener;
    private GridCoordinate selection = new GridCoordinate(0, 0);

    NemesisGridPanel(boolean ownsFleet, Consumer<GridCoordinate> fireHandler) {
        this.ownsFleet = ownsFleet;
        this.fireHandler = Objects.requireNonNull(fireHandler, "fireHandler");
        this.cells = new CellButton[BOARD_SIZE][BOARD_SIZE];
        buildUi(ownsFleet ? "Votre flotte" : "Zone ennemie");
        setFocusable(true);
        setFocusTraversalKeysEnabled(false);
        addKeyListener(keyboardHandler);
    }

    void renderOwn(NemesisSession session, Function<NemesisState.Player, String> nameFormatter) {
        if (manualController.isActive()) {
            updateBotBadge(session, nameFormatter);
            return;
        }
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
        updateBotBadge(session, nameFormatter);
    }

    void renderEnemy(NemesisSession session, Function<NemesisState.Player, String> nameFormatter) {
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
        updateBotBadge(session, nameFormatter);
    }

    void setFireSelectionListener(Consumer<GridCoordinate> listener) {
        this.fireSelectionListener = listener;
    }

    void setFiringEnabled(boolean enabled, NemesisSession session) {
        if (ownsFleet) {
            return;
        }
        if (!enabled || session.finished()) {
            interactionMode = InteractionMode.NONE;
            clearSelectionHighlight();
        }

        fireController.disableAll();

        boolean[][] alreadyShot = new boolean[BOARD_SIZE][BOARD_SIZE];
        session.self().ifPresent(self -> self.shots().forEach(shot -> alreadyShot[shot.x()][shot.y()] = true));

        for (int y = 0; y < BOARD_SIZE; y++) {
            for (int x = 0; x < BOARD_SIZE; x++) {
                JButton button = cells[x][y].button();
                if (alreadyShot[x][y] || session.finished()) {
                    button.setEnabled(false);
                    fireController.setDisabled(x, y, true);
                } else {
                    button.setEnabled(enabled);
                    prepare(cells[x][y]);
                    fireController.setDisabled(x, y, !enabled);
                }
            }
        }

        if (enabled && !session.finished()) {
            interactionMode = InteractionMode.FIRE;
            selectFirstAvailableFireCell();
        }
    }

    void beginManualPlacement(NemesisManualPlacementCallbacks callbacks) {
        manualController.begin(callbacks);
        interactionMode = InteractionMode.MANUAL_PLACEMENT;
        clearSelectionHighlight();
        selection = new GridCoordinate(0, 0);
        updateSelectionHighlight();
        refreshManualColors();
        manualController.notifySelectionChanged(selection);
        requestFocusInWindow();
    }

    void updateManualCurrent(List<GridCoordinate> coordinates) {
        manualController.updateCurrent(coordinates);
        refreshManualColors();
    }

    void updateManualCommitted(Collection<ShipPlacement> placements) {
        manualController.updateCommitted(placements);
        refreshManualColors();
    }

    void endManualPlacement() {
        manualController.end();
        interactionMode = InteractionMode.NONE;
        clearSelectionHighlight();
    }

    void clearManualState() {
        manualController.clear();
        refreshManualColors();
    }

    void clear() {
        manualController.end();
        interactionMode = InteractionMode.NONE;
        clearSelectionHighlight();
        setBotBadge(null);
        for (int y = 0; y < BOARD_SIZE; y++) {
            for (int x = 0; x < BOARD_SIZE; x++) {
                JButton button = cells[x][y].button();
                button.setBackground(WATER);
                button.setText("");
                button.setEnabled(false);
            }
        }
        fireController.disableAll();
    }

    private void buildUi(String title) {
        setLayout(new BorderLayout());
        botBadge.setHorizontalAlignment(SwingConstants.CENTER);
        botBadge.setVisible(false);
        botBadge.setFont(botBadge.getFont().deriveFont(Font.BOLD, 13f));
        botBadge.setBorder(BorderFactory.createEmptyBorder(4, 0, 4, 0));
        AccessibleContext badgeContext = botBadge.getAccessibleContext();
        if (badgeContext != null) {
            badgeContext.setAccessibleName(ownsFleet ? "Informations flotte" : "Informations adversaire");
            badgeContext.setAccessibleDescription("Informations spécifiques concernant l'adversaire.");
        }
        add(botBadge, BorderLayout.NORTH);

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
                button.setFocusable(false);
                button.setPreferredSize(new Dimension(32, 32));
                button.setBorder(BorderFactory.createLineBorder(WATER.darker(), 1));
                int coordX = x;
                int coordY = y;
                AccessibleContext accessible = button.getAccessibleContext();
                if (accessible != null) {
                    String coordinate = (ownsFleet ? "Case flotte " : "Case cible ") + humanCoordinate(coordX, coordY);
                    accessible.setAccessibleName(coordinate);
                    accessible.setAccessibleDescription(coordinate);
                }
                if (!ownsFleet) {
                    button.addActionListener(e -> fireHandler.accept(new GridCoordinate(coordX, coordY)));
                }
                cells[x][y] = new CellButton(button, coordX, coordY);
                grid.add(button);
            }
        }
        add(grid, BorderLayout.CENTER);
    }

    private void refreshManualColors() {
        if (!manualController.isActive()) {
            return;
        }
        boolean[][] manualCommitted = manualController.committedGrid();
        boolean[][] manualCurrent = manualController.currentGrid();
        for (int y = 0; y < BOARD_SIZE; y++) {
            for (int x = 0; x < BOARD_SIZE; x++) {
                JButton button = cells[x][y].button();
                if (manualCommitted[x][y]) {
                    button.setBackground(SHIP);
                    button.setText("");
                } else if (manualCurrent[x][y]) {
                    button.setBackground(CURRENT_PLACEMENT);
                    button.setText("");
                } else {
                    button.setBackground(WATER);
                    button.setText("");
                }
                button.setEnabled(false);
            }
        }
        updateSelectionHighlight();
    }

    private void selectFirstAvailableFireCell() {
        GridCoordinate coordinate = fireController.firstAvailable();
        if (coordinate == null) {
            clearSelectionHighlight();
            return;
        }
        selection = coordinate;
        updateSelectionHighlight();
        notifyFireSelection();
    }

    private void moveSelection(int deltaX, int deltaY) {
        if (interactionMode == InteractionMode.MANUAL_PLACEMENT) {
            int newX = Math.max(0, Math.min(BOARD_SIZE - 1, selection.x() + deltaX));
            int newY = Math.max(0, Math.min(BOARD_SIZE - 1, selection.y() + deltaY));
            if (newX != selection.x() || newY != selection.y()) {
                selection = new GridCoordinate(newX, newY);
                updateSelectionHighlight();
                manualController.notifySelectionChanged(selection);
            }
            return;
        }

        if (interactionMode == InteractionMode.FIRE) {
            GridCoordinate next = fireController.next(selection, deltaX, deltaY);
            if (next != null) {
                selection = next;
                updateSelectionHighlight();
                notifyFireSelection();
            } else {
                java.awt.Toolkit.getDefaultToolkit().beep();
            }
        }
    }

    private void handleConfirm() {
        if (interactionMode == InteractionMode.MANUAL_PLACEMENT) {
            manualController.confirm(selection);
        } else if (interactionMode == InteractionMode.FIRE && !fireController.isDisabled(selection.x(), selection.y())) {
            fireHandler.accept(selection);
        }
    }

    private void handleUndo() {
        if (interactionMode == InteractionMode.MANUAL_PLACEMENT) {
            manualController.undo();
        }
    }

    private void setBotBadge(String text) {
        String emptyDescription = ownsFleet
                ? "Informations spécifiques concernant votre flotte."
                : "Informations spécifiques concernant l'adversaire.";
        if (text == null || text.isBlank()) {
            botBadge.setVisible(false);
            botBadge.setText(" ");
            AccessibleContext context = botBadge.getAccessibleContext();
            if (context != null) {
                context.setAccessibleDescription(emptyDescription);
            }
        } else {
            botBadge.setText(text);
            botBadge.setVisible(true);
            AccessibleContext context = botBadge.getAccessibleContext();
            if (context != null) {
                context.setAccessibleDescription(text);
            }
        }
    }

    private void updateBotBadge(NemesisSession session, Function<NemesisState.Player, String> nameFormatter) {
        Objects.requireNonNull(nameFormatter, "nameFormatter");
        Stream<NemesisState.Player> stream = ownsFleet
                ? session.state().players().stream()
                : session.opponents().stream();
        List<String> bots = stream
                .filter(NemesisState.Player::isBot)
                .map(nameFormatter)
                .collect(Collectors.toList());
        if (bots.isEmpty()) {
            setBotBadge(null);
            return;
        }
        String prefix = ownsFleet ? "Bots détectés : " : "Bots adverses : ";
        setBotBadge(prefix + String.join(", ", bots));
    }

    private void handleCancel() {
        if (interactionMode == InteractionMode.MANUAL_PLACEMENT) {
            manualController.cancel();
        }
    }

    private void updateSelectionHighlight() {
        for (int y = 0; y < BOARD_SIZE; y++) {
            for (int x = 0; x < BOARD_SIZE; x++) {
                cells[x][y].setSelected(false);
            }
        }
        if (interactionMode == InteractionMode.NONE) {
            return;
        }
        cells[selection.x()][selection.y()].setSelected(true);
        announceSelectionDetails();
    }

    private void clearSelectionHighlight() {
        for (int y = 0; y < BOARD_SIZE; y++) {
            for (int x = 0; x < BOARD_SIZE; x++) {
                cells[x][y].setSelected(false);
            }
        }
    }

    private void notifyFireSelection() {
        if (fireSelectionListener != null && interactionMode == InteractionMode.FIRE) {
            fireSelectionListener.accept(selection);
        }
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

    private void announceSelectionDetails() {
        String coordinate = humanCoordinate(selection.x(), selection.y());
        String message;
        switch (interactionMode) {
            case MANUAL_PLACEMENT -> {
                boolean committed = manualController.committedGrid()[selection.x()][selection.y()];
                boolean current = manualController.currentGrid()[selection.x()][selection.y()];
                if (committed) {
                    message = "Case " + coordinate + " deja occupee.";
                } else if (current) {
                    message = "Case " + coordinate + " selectionnee pour ce vaisseau.";
                } else {
                    message = "Case " + coordinate + " disponible.";
                }
            }
            case FIRE -> {
                if (fireController.isDisabled(selection.x(), selection.y())) {
                    message = "Case " + coordinate + " indisponible.";
                } else {
                    message = "Cible " + coordinate + ". Entree pour tirer.";
                }
            }
            default -> message = "Case " + coordinate;
        }
        announce(message);
    }

    private void announce(String message) {
        if (message == null || message.isBlank()) {
            return;
        }
        AccessibleContext context = getAccessibleContext();
        if (context != null) {
            String oldDescription = context.getAccessibleDescription();
            String oldName = context.getAccessibleName();
            context.setAccessibleName(message);
            context.setAccessibleDescription(message);
            context.firePropertyChange(AccessibleContext.ACCESSIBLE_NAME_PROPERTY, oldName, message);
            context.firePropertyChange(AccessibleContext.ACCESSIBLE_DESCRIPTION_PROPERTY, oldDescription, message);
        }
    }

    private String humanCoordinate(int x, int y) {
        return (x + 1) + "," + (y + 1);
    }

    private final KeyAdapter keyboardHandler = new KeyAdapter() {
        @Override
        public void keyPressed(KeyEvent e) {
            if (interactionMode == InteractionMode.NONE) {
                return;
            }
            switch (e.getKeyCode()) {
                case KeyEvent.VK_UP -> {
                    moveSelection(0, -1);
                    e.consume();
                }
                case KeyEvent.VK_DOWN -> {
                    moveSelection(0, 1);
                    e.consume();
                }
                case KeyEvent.VK_LEFT -> {
                    moveSelection(-1, 0);
                    e.consume();
                }
                case KeyEvent.VK_RIGHT -> {
                    moveSelection(1, 0);
                    e.consume();
                }
                case KeyEvent.VK_ENTER -> {
                    handleConfirm();
                    e.consume();
                }
                case KeyEvent.VK_BACK_SPACE, KeyEvent.VK_DELETE -> {
                    handleUndo();
                    e.consume();
                }
                case KeyEvent.VK_ESCAPE -> {
                    handleCancel();
                    e.consume();
                }
                case KeyEvent.VK_TAB, KeyEvent.VK_SHIFT -> e.consume();
                default -> {
                    // ignore
                }
            }
        }
    };

    private enum InteractionMode {
        NONE,
        MANUAL_PLACEMENT,
        FIRE
    }

    private record CellButton(JButton button, int x, int y) {
        private void setSelected(boolean selected) {
            if (selected) {
                button.setBorder(BorderFactory.createLineBorder(SELECTION_BORDER, 2));
            } else {
                button.setBorder(BorderFactory.createLineBorder(WATER.darker(), 1));
            }
        }
    }
}



