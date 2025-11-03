package com.lemondelila.client.history.controller;

import com.lemondelila.client.history.model.HistoryModel;
import com.lemondelila.client.history.view.HistoryView;

import java.util.Objects;

/**
 * Controleur MVC pour l'historique.
 */
public final class HistoryController {

    private final HistoryModel model;
    private final HistoryView view;

    public HistoryController(HistoryModel model, HistoryView view) {
        this.model = Objects.requireNonNull(model, "model");
        this.view = Objects.requireNonNull(view, "view");
    }

    public void init() {
        view.renderHistory(model.snapshot());
    }

    public void appendRawMessage(String message) {
        Objects.requireNonNull(message, "message");
        if (message.isBlank()) {
            return;
        }
        model.addMessage(message);
        view.renderHistory(model.snapshot());
    }

    public void clear() {
        model.clear();
        view.renderHistory(model.snapshot());
    }
}
