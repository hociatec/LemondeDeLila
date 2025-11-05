package com.lemondedelila.client.api.dto;

public class ScoreDto {
    public String userId;
    public int score;
    public long timestamp;

    public ScoreDto() {}
    public ScoreDto(String userId, int score, long timestamp) {
        this.userId = userId;
        this.score = score;
        this.timestamp = timestamp;
    }
}
