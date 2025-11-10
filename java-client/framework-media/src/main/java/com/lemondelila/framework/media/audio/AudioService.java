package com.lemondelila.framework.media.audio;

import javax.sound.sampled.AudioInputStream;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.Clip;
import javax.sound.sampled.FloatControl;
import java.io.IOException;
import java.net.URL;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

public final class AudioService implements AutoCloseable {

    private final Map<String, Clip> clips = new ConcurrentHashMap<>();

    public void preload(String key, URL resource) throws Exception {
        Objects.requireNonNull(key, "key");
        Objects.requireNonNull(resource, "resource");
        try (AudioInputStream stream = AudioSystem.getAudioInputStream(resource)) {
            Clip clip = AudioSystem.getClip();
            clip.open(stream);
            clips.put(key, clip);
        }
    }

    public void play(String key) {
        Clip clip = clips.get(key);
        if (clip == null) {
            return;
        }
        if (clip.isRunning()) {
            clip.stop();
        }
        clip.flush();
        clip.setFramePosition(0);
        clip.start();
    }

    public void loop(String key) {
        Clip clip = clips.get(key);
        if (clip == null) {
            return;
        }
        if (clip.isRunning()) {
            clip.stop();
        }
        clip.setFramePosition(0);
        clip.loop(Clip.LOOP_CONTINUOUSLY);
    }

    public void stop(String key) {
        Clip clip = clips.get(key);
        if (clip != null) {
            clip.stop();
        }
    }

    public void setVolume(String key, float gainDb) {
        Clip clip = clips.get(key);
        if (clip == null) {
            return;
        }
        FloatControl control = (FloatControl) clip.getControl(FloatControl.Type.MASTER_GAIN);
        control.setValue(Math.max(control.getMinimum(), Math.min(control.getMaximum(), gainDb)));
    }

    @Override
    public void close() throws IOException {
        for (Clip clip : clips.values()) {
            clip.close();
        }
        clips.clear();
    }
}
