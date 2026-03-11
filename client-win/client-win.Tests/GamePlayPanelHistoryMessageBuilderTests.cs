using System.Collections.Generic;
using System.Text.Json;
using client_win.Modules.Game.Play.Board.Dtos;
using client_win.Modules.Game.Play.Panels.Services;
using client_win.Modules.Game.Play.State.Dtos;
using Xunit;

namespace client_win.Tests;

public sealed class GamePlayPanelHistoryMessageBuilderTests
{
    [Fact]
    public void BuildPositionHistoryMessage_UsesAllBoardPositions_WhenBoardIsComplete()
    {
        var state = CreateState(
            boardPositions: new Dictionary<string, int> { ["1"] = 0, ["2"] = 4 },
            panelPositionMessage: "Positions. A : case 1/10. B : case 5/10.");

        var message = GamePlayPanelHistoryMessageBuilder.BuildPositionHistoryMessage(state);

        Assert.Contains("Positions.", message);
        Assert.Contains("A", message);
        Assert.Contains("B", message);
    }

    [Fact]
    public void BuildPositionHistoryMessage_FallsBackToPanel_WhenBoardPositionsLookTruncated()
    {
        var state = CreateState(
            boardPositions: new Dictionary<string, int> { ["1"] = 0 },
            panelPositionMessage: "Positions. A : tour plateau ?, case 1/10. B : tour plateau ?, case 5/10.");

        var message = GamePlayPanelHistoryMessageBuilder.BuildPositionHistoryMessage(state);

        Assert.Equal("Positions. A : tour plateau ?, case 1/10. B : tour plateau ?, case 5/10.", message);
    }

    private static GameStateDto CreateState(
        Dictionary<string, int> boardPositions,
        string panelPositionMessage)
    {
        using var extrasDoc = JsonDocument.Parse($$"""
        {
          "ui": {
            "panels": {
              "position": {
                "title": "Position",
                "message": "{{panelPositionMessage}}"
              }
            }
          }
        }
        """);

        return new GameStateDto
        {
            Players = new List<GamePlayerDto>
            {
                new() { Id = 1, Username = "A" },
                new() { Id = 2, Username = "B" },
            },
            Extras = extrasDoc.RootElement.Clone(),
            Board = new GameBoardDto
            {
                Positions = boardPositions,
            },
        };
    }
}
