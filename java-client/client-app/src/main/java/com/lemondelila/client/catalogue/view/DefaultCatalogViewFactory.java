package com.lemondelila.client.catalogue.view;

import com.lemondelila.client.framework.media.sound.SoundEffectManager;
import com.lemondelila.client.framework.ui.component.StatusBannerFactory;

import javax.inject.Inject;
import javax.swing.JPanel;

public final class DefaultCatalogViewFactory implements CatalogViewFactory {

    private final SoundEffectManager soundManager;
    private final StatusBannerFactory bannerFactory;

    @Inject
    public DefaultCatalogViewFactory(SoundEffectManager soundManager,
                                     StatusBannerFactory bannerFactory) {
        this.soundManager = soundManager;
        this.bannerFactory = bannerFactory;
    }

    @Override
    public CatalogViewCoordinator create(JPanel host) {
        return new CatalogViewCoordinator(host, soundManager, bannerFactory);
    }
}
