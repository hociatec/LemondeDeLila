using System;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using client_win.Modules.Game.Play.ViewModels;

namespace client_win.Modules.Game.Play.Views;

public partial class GamePlayView : UserControl
{
    private int _initialized;

    public GamePlayView()
    {
        InitializeComponent();
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (System.Threading.Interlocked.Exchange(ref _initialized, 1) == 1)
        {
            return;
        }

        if (DataContext is GamePlayViewModel vm)
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
                await vm.InitializeAsync(cts.Token).ConfigureAwait(true);
            }
            catch
            {
                // Best-effort: l'état de connexion est déjà exposé dans le ViewModel.
            }
        }
    }

    private async void OnChoicesKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Enter)
        {
            return;
        }
        if (DataContext is not GamePlayViewModel vm)
        {
            return;
        }
        // Le ListBox de quiz doit "consommer" Enter pour envoyer la réponse sélectionnée,
        // afin de ne pas déclencher le raccourci global Enter (roll).
        try
        {
            bool sent = await vm.SubmitSelectedChoiceAsync(CancellationToken.None).ConfigureAwait(true);
            if (sent)
            {
                e.Handled = true;
                Focus();
                Keyboard.Focus(this);
            }
        }
        catch
        {
            e.Handled = true;
        }
    }
}
