package com.lemondelila.client.history;

import com.lemondelila.client.history.controller.HistoryController;
import com.lemondelila.client.history.model.HistoryModel;
import com.lemondelila.client.history.service.HistoryService;
import com.lemondelila.client.history.view.SwingHistoryView;

/**
 * Point d'assemblage du module Historique.
 */
public final class HistoryModule {

    private final HistoryModel model;
    private final SwingHistoryView view;
    private final HistoryController controller;
    private final HistoryService service;

    public HistoryModule() {
        this.model = new HistoryModel();
        this.view = new SwingHistoryView();
        this.controller = new HistoryController(model, view);
        this.service = new HistoryService(controller);
        controller.init();
    }

    public HistoryService service() {
        return service;
    }

    public SwingHistoryView view() {
        return view;
    }
}
