package com.lemondelila.client.rules.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public class RulesService {

    public String getRules(String game) {
        try {
            InputStream stream = RulesService.class.getResourceAsStream("/rules/" + game + ".html");
            if (stream == null) {
                return "<html><body><h1>" + game + "</h1><p>Aucune regle pour ce jeu.</p></body></html>";
            }
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            return "<html><body><h1>Erreur</h1><p>Impossible de charger les regles du jeu.</p></body></html>";
        }
    }
}
