using System;
using System.Threading;
using System.Windows;
using System.Windows.Threading;
using client_win.Modules.Game.Play.GamePlay.ViewModels;

namespace client_win.Modules.Game.Play.GamePlay.Views;

public partial class GamePlayView
{
    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        LayoutUpdated += OnLayoutUpdated;
        UpdateChoicesAccessibility();
        var vm = DataContext as GamePlayViewModel;
        HookChoiceAutoFocus(vm);
        HookHandAutoFocus(vm);
        HookInlinePromptAutoFocus(vm);
        TryStartInitialization(vm);

        // Assure le focus clavier dès l'entrée dans une table (sinon Enter/B/Space ne partent pas sans clic souris).
        FocusPreferredInteractiveElement();
    }

    private void OnDataContextChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        var vm = DataContext as GamePlayViewModel;
        HookChoiceAutoFocus(vm);
        HookHandAutoFocus(vm);
        HookInlinePromptAutoFocus(vm);
        TryStartInitialization(vm);

        FocusPreferredInteractiveElement();
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        LayoutUpdated -= OnLayoutUpdated;
        HookChoiceAutoFocus(null);
        HookHandAutoFocus(null);
        HookInlinePromptAutoFocus(null);
        UnhookChoicesListFocusObservers();
        UnhookHandListFocusObservers();
        UnhookGridFocusObservers();
        UnhookInlinePromptFocusObserver();
        CancelInitialization();
        UnhookGridGenerator();
    }

    private void OnLayoutUpdated(object? sender, EventArgs e)
    {
        TryRecoverPendingInteractiveFocusFromLayout();
        TryRecoverPostPawnSelectionFocusFromLayout();
    }

    private void TryStartInitialization(GamePlayViewModel? vm)
    {
        if (vm == null)
        {
            return;
        }

        if (ReferenceEquals(_initVm, vm))
        {
            return;
        }

        CancelInitialization();
        _initVm = vm;
        _initCts = new CancellationTokenSource();
        var expectedVm = vm;
        var expectedToken = _initCts.Token;

        // IMPORTANT: démarrer après le rendu initial pour éviter une sensation de "lag" à l'ouverture.
        Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
        {
            if (expectedToken.IsCancellationRequested || !ReferenceEquals(_initVm, expectedVm))
            {
                return;
            }

            _ = InitializeVmAsync(expectedVm, expectedToken);
        }));
    }

    private void CancelInitialization()
    {
        try
        {
            _initCts?.Cancel();
        }
        catch
        {
            // Best-effort
        }

        _initCts?.Dispose();
        _initCts = null;
        _initVm = null;
    }

    private static async System.Threading.Tasks.Task InitializeVmAsync(GamePlayViewModel vm, CancellationToken cancellationToken)
    {
        try
        {
            await vm.InitializeAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // ignore
        }
        catch
        {
            // Best-effort: l'état de connexion est déjà exposé dans le ViewModel.
        }
    }
}
