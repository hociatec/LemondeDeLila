package com.lemondelila.client.rules.service;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

public class RulesServiceTest {

    @Test
    public void testGetRules() {
        RulesService rulesService = new RulesService();
        String rules = rulesService.getRules("test");
        assertEquals("<html><body><h1>test</h1><p>Aucune regle pour ce jeu.</p></body></html>", rules);
    }
}
