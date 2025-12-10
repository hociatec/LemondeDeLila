package com.lemondelila.client.gamelogic.panierexpress.view;

import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.game.core.controller.GenericGameInteractionController;
import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.game.core.view.GameInteractionComponent;
import com.lemondelila.client.game.core.view.GenericGameInteractionComponent;
import com.lemondelila.client.game.exchange.controller.ExchangeController;
import com.lemondelila.client.game.exchange.model.ExchangePrompt;
import com.lemondelila.client.game.exchange.view.ExchangeView;
import com.lemondelila.client.gamelogic.panierexpress.service.PanierExpressStateAdapter;
import com.lemondelila.client.gamelogic.panierexpress.service.PanierPlayerItems;
import com.lemondelila.client.user.model.ClientSession;

import javax.swing.AbstractAction;
import javax.swing.ActionMap;
import javax.swing.InputMap;
import javax.swing.JComponent;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.util.Objects;
import java.util.function.Consumer;

final class PanierExpressGameComponent extends JPanel implements GameInteractionComponent {

    private final GenericGameInteractionComponent baseComponent;
    private final GenericGameInteractionController controller;
    private final ExchangeController exchangeController;
    private final ExchangeView exchangeView;
    private final PanierExpressStateAdapter stateAdapter;
    private Consumer<GenericGameState> observer;
    private final PanierExpressInventoryPanel inventoryPanel = new PanierExpressInventoryPanel();
    private PanierPlayerItems latestItems;

    PanierExpressGameComponent(GenericGameInteractionComponent baseComponent,
                               GenericGameInteractionController controller,
                               ExchangeController exchangeController,
                               ExchangeView exchangeView,
                               ClientSession session) {
        super(new BorderLayout(8, 8));
        this.baseComponent = Objects.requireNonNull(baseComponent, "baseComponent");
        this.controller = Objects.requireNonNull(controller, "controller");
        this.exchangeController = Objects.requireNonNull(exchangeController, "exchangeController");
        this.exchangeView = Objects.requireNonNull(exchangeView, "exchangeView");
        this.stateAdapter = new PanierExpressStateAdapter(Objects.requireNonNull(session, "session"));
        baseComponent.registerExchangeComponent(exchangeView);
        add(baseComponent, BorderLayout.CENTER);
        add(inventoryPanel, BorderLayout.EAST);
        inventoryPanel.setVisible(false);
        registerInventoryShortcuts();
    }

    @Override
    public void onAttach(int roomId) {
        registerObserver();
        baseComponent.onAttach(roomId);
    }

    @Override
    public void onDetach() {
        baseComponent.onDetach();
        if (observer != null) {
            controller.removeStateObserver(observer);
            observer = null;
        }
        exchangeController.clearPrompt();
        baseComponent.showExchangePanel(false);
        inventoryPanel.hidePanel();
        latestItems = null;
    }

    @Override
    public javax.swing.JComponent getComponent() {
        return this;
    }

    @Override
    public ScreenId id() {
        return baseComponent.id();
    }

    private void registerObserver() {
        if (observer != null) {
            controller.removeStateObserver(observer);
        }
        observer = state -> {
            ExchangePrompt prompt = stateAdapter.mapExchangePrompt(state);
            exchangeController.setPrompt(prompt);
            baseComponent.showExchangePanel(prompt != null);
            latestItems = stateAdapter.mapPlayerItems(state);
            inventoryPanel.updateItems(latestItems);
        };
        controller.addStateObserver(observer);
    }

    private void registerInventoryShortcuts() {
        InputMap inputMap = getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        ActionMap actionMap = getActionMap();
        if (inputMap == null || actionMap == null) {
            return;
        }
        inputMap.put(KeyStroke.getKeyStroke('P'), "panier.show");
        actionMap.put("panier.show", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                inventoryPanel.updateItems(latestItems);
                inventoryPanel.showBasket();
            }
        });
        inputMap.put(KeyStroke.getKeyStroke('I'), "panier.inventory");
        actionMap.put("panier.inventory", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                inventoryPanel.updateItems(latestItems);
                inventoryPanel.showInventory();
            }
        });
        inputMap.put(KeyStroke.getKeyStroke("ESCAPE"), "panier.hide");
        actionMap.put("panier.hide", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                inventoryPanel.hidePanel();
            }
        });
    }
}
