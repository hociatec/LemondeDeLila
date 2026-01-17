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

    public HomeView()
    {
        InitializeComponent();
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        AttachViewModel();
        FocusFirstField();
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        DetachViewModel();
    }

    private void OnDataContextChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        DetachViewModel();
        AttachViewModel();
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
                    case HomePage.Login:
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
                        break;

                    case HomePage.Register:
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
                        break;
                }
            }
            catch
            {
                // Focus is best-effort: never crash the UI thread.
            }
        }));
    }

    public void RequestInitialFocus()
    {
        FocusFirstField();
    }
}
