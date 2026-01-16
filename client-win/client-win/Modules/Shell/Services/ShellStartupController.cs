using System;
using System.Threading.Tasks;
using client_win.Modules.Config;
using client_win.Modules.Error;
using client_win.Modules.Home.ViewModels;
using client_win.Modules.Updates;

namespace client_win.Modules.Shell.Services;

public sealed class ShellStartupController
{
    private readonly INavigationService _navigation;
    private readonly HomeViewModel _homeViewModel;
    private readonly ClientConfiguration _config;
    private readonly IDialogService _dialogs;
    private readonly ErrorBus _errors;

    public ShellStartupController(
        INavigationService navigation,
        HomeViewModel homeViewModel,
        ClientConfiguration config,
        IDialogService dialogs,
        ErrorBus errors)
    {
        _navigation = navigation ?? throw new ArgumentNullException(nameof(navigation));
        _homeViewModel = homeViewModel ?? throw new ArgumentNullException(nameof(homeViewModel));
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _errors = errors ?? throw new ArgumentNullException(nameof(errors));
    }

    public async Task OnLoadedAsync()
    {
        _navigation.Show(_homeViewModel);

        try
        {
            var initTask = _homeViewModel.InitializeAsync();
            var updateTask = ClientUpdateStartupPrompt.CheckAndPromptAsync(_config, _dialogs);

            var shouldContinue = await updateTask.ConfigureAwait(true);
            if (!shouldContinue)
            {
                return;
            }

            await initTask.ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            _errors.Publish(new AppError(
                "Erreur lors de l'initialisation de l'application.",
                ErrorSeverity.Error,
                context: "app.startup",
                detail: ex.Message));
        }
    }
}
