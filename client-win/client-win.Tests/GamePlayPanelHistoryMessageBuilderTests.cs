using System.Text.Json;
using client_win.Modules.Game.Play.Panels.Services;
using client_win.Modules.Game.Play.State.Dtos;
using Xunit;

namespace client_win.Tests;

public sealed class GamePlayPanelHistoryMessageBuilderTests
{
    [Fact]
    public void BuildPanelHistoryMessage_Position_UsesPanelMessage()
    {
        var state = CreateState("Positions. A : case 1/10. B : case 5/10.");

        var message = GamePlayPanelHistoryMessageBuilder.BuildPanelHistoryMessage(state, "position");

        Assert.Equal("Positions. A : case 1/10. B : case 5/10.", message);
    }

    [Fact]
    public void BuildPanelHistoryMessage_Position_ReturnsEmpty_WhenPanelMissing()
    {
        var state = new GameStateDto
        {
            Extras = JsonDocument.Parse("{}").RootElement.Clone(),
        };

        var message = GamePlayPanelHistoryMessageBuilder.BuildPanelHistoryMessage(state, "position");

        Assert.Equal(string.Empty, message);
    }

    private static GameStateDto CreateState(string panelPositionMessage)
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
            Extras = extrasDoc.RootElement.Clone(),
        };
    }
}
