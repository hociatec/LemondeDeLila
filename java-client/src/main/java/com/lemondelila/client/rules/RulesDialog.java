package com.lemondelila.client.rules;

import javax.swing.*;
import java.awt.event.KeyEvent;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

public class RulesDialog extends JDialog {

    public RulesDialog(JFrame owner, String gameId, URI apiBaseUri) {
        super(owner, "Game Rules", true);
        setSize(600, 400);
        setLocationRelativeTo(owner);

        JTextArea rulesArea = new JTextArea();
        rulesArea.setEditable(false);
        JScrollPane scrollPane = new JScrollPane(rulesArea);
        add(scrollPane);

        // Close on Escape
        getRootPane().registerKeyboardAction(e -> dispose(),
                KeyStroke.getKeyStroke(KeyEvent.VK_ESCAPE, 0),
                JComponent.WHEN_IN_FOCUSED_WINDOW);

        // Load rules
        try {
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(apiBaseUri.resolve("games/" + gameId + "/rules"))
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            rulesArea.setText(response.body());
        } catch (IOException | InterruptedException e) {
            rulesArea.setText("Could not load rules: " + e.getMessage());
        }
    }
}
