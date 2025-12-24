using System;
using System.Windows.Controls;
using client_win.Modules.Game.Models;
using client_win.Modules.Game.ViewModels;
using client_win.Modules.Game.Views;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Services;

public sealed class RoomTableNavigator : IRoomTableNavigator
{
    private readonly INavigationService _navigation;
    private readonly IRoomSessionFactory _sessionFactory;
    private readonly IDialogService _dialogs;

    public RoomTableNavigator(INavigationService navigation, IRoomSessionFactory sessionFactory, IDialogService dialogs)
    {
        _navigation = navigation ?? throw new ArgumentNullException(nameof(navigation));
        _sessionFactory = sessionFactory ?? throw new ArgumentNullException(nameof(sessionFactory));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
    }

    public void OpenRoom(RoomLaunchRequest request)
    {
        var previous = _navigation.CurrentView;
        var view = new RoomTableView();
        var vm = new RoomTableViewModel(request, _sessionFactory, _dialogs, onClose: () =>
        {
            if (previous != null)
            {
                _navigation.Show(previous);
            }
        });
        view.DataContext = vm;
        _navigation.Show(view);
    }
}
