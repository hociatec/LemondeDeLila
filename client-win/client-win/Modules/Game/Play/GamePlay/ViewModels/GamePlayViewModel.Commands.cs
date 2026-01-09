using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.GamePlay.ViewModels;

public sealed partial class GamePlayViewModel
{
    private void RefreshCanExecute()
    {
        _commands.RefreshCanExecute();
        Grid.RefreshCanExecute();
    }

    private void SyncShortcuts(GameStateDto state) => _shortcuts.SyncFromState(state);
}

