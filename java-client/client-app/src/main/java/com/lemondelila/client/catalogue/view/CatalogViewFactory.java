package com.lemondelila.client.catalogue.view;

import javax.swing.JPanel;

/**
 * Définit comment construire la vue du catalogue depuis un hôte.
 */
public interface CatalogViewFactory {

    CatalogViewCoordinator create(JPanel host);
}
