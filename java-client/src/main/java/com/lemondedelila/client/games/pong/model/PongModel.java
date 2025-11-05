package com.lemondedelila.client.games.pong.model;

import com.lemondedelila.client.mvc.model.GameModel;

public class PongModel extends GameModel {
    private int ballX = 50, ballY = 50;
    private int dx = 2, dy = 2;

    public int getBallX() { return ballX; }
    public int getBallY() { return ballY; }

    public void update() {
        ballX += dx; ballY += dy;
        if (ballX < 0 || ballX > 300) dx = -dx;
        if (ballY < 0 || ballY > 200) dy = -dy;
    }
}
