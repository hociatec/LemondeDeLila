package com.lemondelila.client.chat.presenter;

import com.lemondelila.client.chat.model.ChatMessage;
import com.lemondelila.client.chat.model.ChatState;
import com.lemondelila.client.presence.model.PresencePlayer;

import java.util.List;

public interface ChatView {

    void showHistory(List<ChatMessage> messages);

    void appendMessage(ChatMessage message);

    void showStatus(ChatState state);

    void showError(String message);

    void updatePresence(List<PresencePlayer> players);
}

