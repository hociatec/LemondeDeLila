package com.lemondelila.client.application.view.menu;

import com.lemondelila.client.media.SoundBank;
import com.lemondelila.client.framework.media.sound.SoundEffectManager;

final class MainMenuAudio {

    private final SoundEffectManager sounds;

    MainMenuAudio(SoundEffectManager sounds) {
        this.sounds = sounds;
    }

    void playAppLaunch() {
        if (sounds != null) {
            sounds.play(SoundBank.APP_LAUNCH);
        }
    }

    void startBackground() {
        if (sounds != null) {
            sounds.play(SoundBank.BACKGROUND_FON);
        }
    }

    void stopBackground() {
        if (sounds != null) {
            sounds.stop(SoundBank.BACKGROUND_FON);
        }
    }

    void playNavigate() {
        if (sounds != null) {
            sounds.play(SoundBank.MENU_NAVIGATE);
        }
    }

    void playSelect() {
        if (sounds != null) {
            sounds.play(SoundBank.MENU_SELECT);
        }
    }
}
