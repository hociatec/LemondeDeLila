package com.lemondelila.client.game.exchange.model;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Observable holder for the current exchange prompt.
 */
public final class ExchangeCollection {

    private final List<Listener> listeners = new CopyOnWriteArrayList<>();
    private ExchangePrompt prompt;

    public ExchangePrompt prompt() {
        return prompt;
    }

    public void setPrompt(ExchangePrompt prompt) {
        this.prompt = prompt;
        notifyListeners();
    }

    public void clear() {
        this.prompt = null;
        notifyListeners();
    }

    public void addListener(Listener listener) {
        if (listener != null) {
            listeners.add(listener);
        }
    }

    public void removeListener(Listener listener) {
        listeners.remove(listener);
    }

    private void notifyListeners() {
        for (Listener listener : listeners) {
            listener.onPromptChanged(prompt);
        }
    }

    public interface Listener {
        void onPromptChanged(ExchangePrompt prompt);
    }
}
