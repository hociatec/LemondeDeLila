using System;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using client_win.Modules.Audio.Services;
using client_win.Modules.Settings.Services;

namespace client_win.Modules.Shell.Services;

public sealed class ShellCloseCoordinator
{
    private readonly IDialogService _dialogs;
    private readonly IOptionsService _options;
    private readonly IAppAudioCoordinator _audio;

    private int _exitConfirmed;
    private int _exitPromptOpen;

    public ShellCloseCoordinator(IDialogService dialogs, IOptionsService options, IAppAudioCoordinator audio)
    {
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _audio = audio ?? throw new ArgumentNullException(nameof(audio));
    }

    public void OnClosing(Func<bool> isLoggedIn, CancelEventArgs e)
    {
        if (e == null) throw new ArgumentNullException(nameof(e));
        if (Volatile.Read(ref _exitConfirmed) == 1)
        {
            return;
        }

        var loggedIn = isLoggedIn?.Invoke() == true;
        var shouldConfirm = _options.Current.ConfirmExit;
        if (!shouldConfirm && !loggedIn)
        {
            return;
        }

        e.Cancel = true;
        if (Interlocked.CompareExchange(ref _exitPromptOpen, 1, 0) != 0)
        {
            return;
        }

        Application.Current?.Dispatcher?.BeginInvoke(async () =>
        {
            try
            {
                if (shouldConfirm)
                {
                    var ok = await _dialogs
                        .Confirm(
                            "Quitter",
                            "Voulez-vous vraiment quitter Le Monde de Lila ?",
                            okText: "Quitter",
                            cancelText: "Annuler")
                        .ConfigureAwait(true);
                    if (ok != true)
                    {
                        return;
                    }
                }

                if (loggedIn)
                {
                    await _audio.PlayClosingAndWaitAsync(TimeSpan.FromSeconds(4)).ConfigureAwait(true);
                }

                Volatile.Write(ref _exitConfirmed, 1);
                Application.Current?.Shutdown();
            }
            catch
            {
                Volatile.Write(ref _exitConfirmed, 1);
                Application.Current?.Shutdown();
            }
            finally
            {
                Interlocked.Exchange(ref _exitPromptOpen, 0);
            }
        }, DispatcherPriority.Normal);
    }
}
