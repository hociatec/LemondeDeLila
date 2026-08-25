using System.Text.Json;
using System.Windows.Input;
using client_win.Modules.Game.Play.Shortcuts.ViewModels;
using client_win.Modules.Game.Play.State.Dtos;
using client_win.Modules.Game.Play.State.Services;
using Xunit;

namespace client_win.Tests;

public sealed class GamePlayShortcutRoutingTests
{
    [Fact]
    public void SpaceActionShortcut_UsesDrawActionInsteadOfSendingRawKey()
    {
        var sendKey = new CaptureCommand();
        var sendAction = new CaptureCommand();
        var shortcuts = new GamePlayShortcutsViewModel(sendKey, sendAction, new CaptureCommand());
        var state = new GameStateDto
        {
            Extras = JsonSerializer.SerializeToElement(new
            {
                shortcuts = new[]
                {
                    new { key = "pressed SPACE", type = "action", actionType = "draw" },
                },
            }),
        };

        shortcuts.SyncFromState(state);

        var shortcut = Assert.Single(
            shortcuts.Shortcuts,
            item => string.Equals(item.Code, "server.key.space", StringComparison.OrdinalIgnoreCase));
        Assert.Equal(Key.Space, shortcut.Gesture?.Key);
        Assert.Same(sendAction, shortcut.Command);
        Assert.Equal("draw", shortcut.CommandParameter);
    }

    [Fact]
    public void HandCard_KeepsServerActionIndexForEnterActivation()
    {
        var state = new GameStateDto
        {
            Extras = JsonSerializer.SerializeToElement(new
            {
                hand = new[]
                {
                    new { id = "6", label = "6", disabled = false, actionIndex = 2 },
                },
            }),
        };

        var card = Assert.Single(GamePlayExtrasParser.ExtractHandCards(state));

        Assert.Equal(2, card.ActionIndex);
    }

    private sealed class CaptureCommand : ICommand
    {
        public bool CanExecute(object? parameter) => true;
        public void Execute(object? parameter) { }
        public event EventHandler? CanExecuteChanged
        {
            add { }
            remove { }
        }
    }
}
