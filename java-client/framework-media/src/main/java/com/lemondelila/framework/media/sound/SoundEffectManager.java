package com.lemondelila.framework.media.sound;

import com.lemondelila.framework.media.audio.AudioService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URL;
import java.util.Collection;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Centralises the playback of short audio clips and handles user preferences.
 */
public final class SoundEffectManager {

    private static final Logger LOGGER = LoggerFactory.getLogger(SoundEffectManager.class);

    private final AudioService audioService;
    private final Map<String, SoundClip> clips = new ConcurrentHashMap<>();
    private final Set<String> looping = ConcurrentHashMap.newKeySet();
    private final Set<String> loaded = ConcurrentHashMap.newKeySet();

    private SoundPreferences preferences = SoundPreferences.disabled();

    public SoundEffectManager(AudioService audioService) {
        this.audioService = Objects.requireNonNull(audioService, "audioService");
    }

    public void registerClips(Collection<? extends SoundClip> candidates) {
        if (candidates == null) {
            return;
        }
        candidates.forEach(candidate -> clips.put(candidate.key(), candidate));
    }

    public void applyPreferences(SoundPreferences preferences) {
        if (preferences == null) {
            this.preferences = SoundPreferences.disabled();
            stopAllLooping();
            return;
        }
        this.preferences = preferences;
        updateLoopingState();
    }

    public void play(SoundClip clip) {
        if (clip == null) {
            return;
        }
        String key = clip.key();
        int volume = resolveVolume(key);
        if (!preferences.isEnabled(key) || volume <= 0) {
            stopLoop(key);
            return;
        }
        if (!ensureLoaded(clip)) {
            return;
        }
        applyVolume(key, volume);
        try {
            if (clip.loop()) {
                audioService.loop(key);
                looping.add(key);
            } else {
                audioService.play(key);
            }
        } catch (Exception ex) {
            LOGGER.warn("Lecture audio impossible pour {} ({})", clip.key(), clip.resourcePath(), ex);
        }
    }

    public void stop(SoundClip clip) {
        if (clip == null) {
            return;
        }
        stopLoop(clip.key());
    }

    public void stopAllLooping() {
        for (String key : looping) {
            try {
                audioService.stop(key);
            } catch (Exception ignored) {
            }
        }
        looping.clear();
    }

    private void stopLoop(String key) {
        if (looping.remove(key)) {
            try {
                audioService.stop(key);
            } catch (Exception ignored) {
            }
        }
    }

    private boolean ensureLoaded(SoundClip clip) {
        clips.putIfAbsent(clip.key(), clip);
        if (loaded.contains(clip.key())) {
            return true;
        }
        try {
            URL resource = SoundEffectManager.class.getResource(clip.resourcePath());
            if (resource == null) {
                LOGGER.warn("Ressource audio introuvable: {}", clip.resourcePath());
                return false;
            }
            audioService.preload(clip.key(), resource);
            loaded.add(clip.key());
            return true;
        } catch (Exception ex) {
            LOGGER.warn("Impossible de charger le son {} ({})", clip.key(), clip.resourcePath(), ex);
            return false;
        }
    }

    private void applyVolume(String key, int volume) {
        try {
            audioService.setVolume(key, toDecibel(volume));
        } catch (Exception ignored) {
        }
    }

    private void updateLoopingState() {
        for (String key : looping) {
            int volume = resolveVolume(key);
            if (!preferences.isEnabled(key) || volume <= 0) {
                stopLoop(key);
            } else {
                applyVolume(key, volume);
            }
        }
    }

    private int resolveVolume(String key) {
        int volume = 0;
        try {
            volume = preferences.volumeFor(key);
        } catch (Exception ignored) {
        }
        return Math.max(0, Math.min(100, volume));
    }

    private float toDecibel(int volume) {
        if (volume <= 0) {
            return -80f;
        }
        float linear = volume / 100f;
        return Math.max(-80f, Math.min(0f, (float) (Math.log10(linear) * 20.0)));
    }
}
