using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Config;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Updates;

public static class ClientUpdateStartupPrompt
{
    public static async Task<bool> CheckAndPromptAsync(
        ClientConfiguration config,
        IDialogService dialogs,
        CancellationToken cancellationToken = default)
    {
        return await ClientUpdateManager
            .CheckAtStartupAsync(config, dialogs, cancellationToken)
            .ConfigureAwait(true);
    }
}
