package com.lemondelila.client.catalogue.service.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public final class GameSummaryDto {

    private String code;
    private String name;
    private int minPlayers;
    private int maxPlayers;
    private String engine;
    private String summary;
    private boolean hasRules;
    private List<String> categories;

    public String code() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String name() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int minPlayers() {
        return minPlayers;
    }

    public void setMinPlayers(int minPlayers) {
        this.minPlayers = minPlayers;
    }

    public int maxPlayers() {
        return maxPlayers;
    }

    public void setMaxPlayers(int maxPlayers) {
        this.maxPlayers = maxPlayers;
    }

    public String engine() {
        return engine;
    }

    public void setEngine(String engine) {
        this.engine = engine;
    }

    public String summary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public boolean hasRules() {
        return hasRules;
    }

    public void setHasRules(boolean hasRules) {
        this.hasRules = hasRules;
    }

    public List<String> categories() {
        return categories;
    }

    public void setCategories(List<String> categories) {
        this.categories = categories;
    }
}
