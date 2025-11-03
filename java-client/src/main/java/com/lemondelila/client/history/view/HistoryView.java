package com.lemondelila.client.history.view;

import java.util.List;

/**
 * Contrat d'affichage pour l'historique applicatif.
 */
public interface HistoryView {

    void renderHistory(List<String> messages);
}
