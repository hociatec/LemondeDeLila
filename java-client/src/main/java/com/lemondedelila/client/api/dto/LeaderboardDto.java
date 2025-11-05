package com.lemondedelila.client.api.dto;

import java.util.List;

public class LeaderboardDto {
    public String gameId;
    public List<Entry> entries;

    public static class Entry {
        public String userId;
        public int score;
    }
}
