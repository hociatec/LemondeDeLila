using client_win.Modules.Game.Play.Session.Services;
using client_win.Modules.Game.Play.State.Dtos;
using Xunit;

namespace client_win.Tests;

public sealed class GameSessionStateOrderingTests
{
    [Fact]
    public void ShouldApplyState_RejectsOlderSetupStateAfterRoundStarted()
    {
        var current = new GameStateDto
        {
            Version = 8,
            Status = "started",
            Phase = "round",
        };
        var staleSetup = new GameStateDto
        {
            Version = 7,
            Status = "setup",
            Phase = "setup",
        };

        Assert.False(GameSession.ShouldApplyState(current, staleSetup));
    }

    [Fact]
    public void ShouldApplyState_AcceptsNewerStateAndLegacyUnversionedState()
    {
        var current = new GameStateDto { Version = 8 };

        Assert.True(GameSession.ShouldApplyState(
            current,
            new GameStateDto { Version = 9 }));
        Assert.True(GameSession.ShouldApplyState(
            current,
            new GameStateDto { Version = 0 }));
    }
}
