package com.lemondelila.framework.media.audio;

import java.util.Objects;

public final class AudioTheme {

    private final AudioService audioService;
    private final String trackKey;

    public AudioTheme(AudioService audioService, String trackKey) {
        this.audioService = Objects.requireNonNull(audioService, "audioService");
        this.trackKey = Objects.requireNonNull(trackKey, "trackKey");
    }

    public void start() {
        audioService.loop(trackKey);
    }

    public void stop() {
        audioService.stop(trackKey);
    }
}

