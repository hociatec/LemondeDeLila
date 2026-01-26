using System;
using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Home.ViewModels;
using client_win.Modules.Shell.Services;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Home.Views;

/// <summary>
/// Vue principale de l'écran d'accueil avec formulaires de connexion et d'inscription.
/// </summary>
public partial class HomeView : UserControl, IInitialFocusTarget
{
    private HomeViewModel? _viewModel;
    private Window? _hostWindow;
    private EventHandler? _hostWindowActivatedHandler;

    public HomeView()
    {
        InitializeComponent();
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        AttachViewModel();
        AttachHostWindowFocusRetry();
        FocusFirstField();
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        DetachHostWindowFocusRetry();
        DetachViewModel();
    }

    private void OnDataContextChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        DetachViewModel();
        AttachViewModel();
        AttachHostWindowFocusRetry();
        FocusFirstField();
    }

    private void AttachViewModel()
    {
        if (DataContext is HomeViewModel vm)
        {
            _viewModel = vm;
            vm.PropertyChanged += OnViewModelPropertyChanged;
        }
    }

    private void DetachViewModel()
    {
        if (_viewModel != null)
        {
            _viewModel.PropertyChanged -= OnViewModelPropertyChanged;
            _viewModel = null;
        }
    }

    private void OnViewModelPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(HomeViewModel.CurrentPage) ||
            e.PropertyName == nameof(HomeViewModel.IsLoginVisible) ||
            e.PropertyName == nameof(HomeViewModel.IsRegisterVisible))
        {
            FocusFirstField();
        }
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (_viewModel != null &&
            e.Key == Key.Escape &&
            _viewModel.CurrentPage != HomePage.Landing &&
            _viewModel.ShowLandingCommand.CanExecute(null))
        {
            _viewModel.ShowLandingCommand.Execute(null);
            e.Handled = true;
            return;
        }

        if (IsNavigationKey(e.Key) && !IsTextEditingControl(e.OriginalSource))
        {
            e.Handled = true;
        }
    }

    private void OnCommandButtonPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Handled || e.IsRepeat)
        {
            return;
        }

        if (e.Key != Key.Enter && e.Key != Key.Return)
        {
            return;
        }

        if (sender is not ButtonBase button)
        {
            return;
        }

        var command = button.Command;
        var parameter = button.CommandParameter;
        if (command == null || !command.CanExecute(parameter))
        {
            return;
        }

        // IMPORTANT (NVDA): if navigation happens while the key event is still being processed,
        // the focused button may disappear -> "indisponible". Park focus and defer execution.
        e.Handled = true;
        FocusParking.Park();
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
        {
            try
            {
                command.Execute(parameter);
            }
            catch
            {
                // best-effort
            }
        }));
    }

    private static bool IsNavigationKey(Key key)
    {
        return key == Key.Up ||
               key == Key.Down ||
               key == Key.Left ||
               key == Key.Right ||
               key == Key.Home ||
               key == Key.End ||
               key == Key.PageUp ||
               key == Key.PageDown;
    }

    private static bool IsTextEditingControl(object? source)
    {
        return source is TextBoxBase || source is PasswordBox;
    }

        private void FocusFirstField()
        {
            var vm = _viewModel;
            if (vm == null)
            {
                return;
            }

            Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
            {
                try
                {
                    if (!ReferenceEquals(_viewModel, vm) || !IsLoaded || !IsVisible)
                    {
                        return;
                    }

                    switch (vm.CurrentPage)
                    {
                        case HomePage.Landing:
                            FocusLandingButton();
                            break;

                        case HomePage.Login:
                            FocusLoginField();
                            break;

                        case HomePage.Register:
                            FocusRegisterField();
                            break;
                    }
                }
                catch
                {
                    // Focus is best-effort: never crash the UI thread.
                }
            }));
        }

        private void FocusLandingButton()
        {
            if (LandingPrimaryButton?.IsVisible == true && LandingPrimaryButton.IsEnabled)
            {
                LandingPrimaryButton.Focus();
            }
        }

        private void FocusLoginField()
        {
            if (LoginUsernameBox?.IsVisible == true && LoginUsernameBox.IsEnabled)
            {
                LoginUsernameBox.Focus();
            }
            else if (LoginPasswordBox?.IsVisible == true && LoginPasswordBox.IsEnabled)
            {
                LoginPasswordBox.Focus();
            }
            else if (LoginPasswordTextBox?.IsVisible == true && LoginPasswordTextBox.IsEnabled)
            {
                LoginPasswordTextBox.Focus();
            }
        }

        private void FocusRegisterField()
        {
            if (RegisterUsernameBox?.IsVisible == true && RegisterUsernameBox.IsEnabled)
            {
                RegisterUsernameBox.Focus();
            }
            else if (RegisterEmailBox?.IsVisible == true && RegisterEmailBox.IsEnabled)
            {
                RegisterEmailBox.Focus();
            }
            else if (RegisterPasswordBox?.IsVisible == true && RegisterPasswordBox.IsEnabled)
            {
                RegisterPasswordBox.Focus();
            }
            else if (RegisterPasswordTextBox?.IsVisible == true && RegisterPasswordTextBox.IsEnabled)
            {
                RegisterPasswordTextBox.Focus();
            }
        }

    private void AttachHostWindowFocusRetry()
    {
        try
        {
            var window = Window.GetWindow(this);
            if (window == null)
            {
                return;
            }

            if (ReferenceEquals(_hostWindow, window) && _hostWindowActivatedHandler != null)
            {
                return;
            }

            DetachHostWindowFocusRetry();
            _hostWindow = window;

            // Au démarrage, la vue peut être chargée avant que la fenêtre ne soit réellement active
            // (surtout via ClickOnce / démarrage silencieux). NVDA ne "voit" pas le focus tant que
            // la fenêtre n'a pas le focus OS. On retente au moment de l'activation.
            _hostWindowActivatedHandler = (_, _) =>
            {
                try
                {
                    if (!IsLoaded || !IsVisible)
                    {
                        return;
                    }

                    Dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(() =>
                    {
                        try
                        {
                            FocusFirstField();
                        }
                        catch
                        {
                            // best-effort
                        }
                    }));
                }
                catch
                {
                    // best-effort
                }
            };

            window.Activated += _hostWindowActivatedHandler;

            // Si la fenêtre est déjà active au moment où on attache le handler, l'événement Activated
            // a potentiellement déjà eu lieu (au tout début du démarrage). Dans ce cas, on fait un
            // "retry" immédiat pour éviter d'obliger l'utilisateur à alt-tab.
            if (window.IsActive)
            {
                Dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(() =>
                {
                    try
                    {
                        FocusFirstField();
                    }
                    catch
                    {
                        // best-effort
                    }
                }));
            }
        }
        catch
        {
            // best-effort
        }
    }

    private void DetachHostWindowFocusRetry()
    {
        try
        {
            if (_hostWindow != null && _hostWindowActivatedHandler != null)
            {
                _hostWindow.Activated -= _hostWindowActivatedHandler;
            }
        }
        catch
        {
            // best-effort
        }
        finally
        {
            _hostWindowActivatedHandler = null;
            _hostWindow = null;
        }
    }

    public void RequestInitialFocus()
    {
        FocusFirstField();
    }
}
