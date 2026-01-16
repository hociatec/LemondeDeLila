using System;
using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Home.ViewModels;

namespace client_win.Modules.Home.Views;

/// <summary>
/// Vue principale de l'écran d'accueil avec formulaires de connexion et d'inscription.
/// La gestion du mot de passe utilise PasswordBoxBehavior pour éliminer la duplication de code
/// et gérer correctement le disposal des SecureStrings.
/// </summary>
public partial class HomeView : UserControl
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
            // Le callback est asynchrone: le DataContext peut avoir changé entre-temps (navigation).
            // On évite un crash si le VM a été détaché après le BeginInvoke.
            if (!ReferenceEquals(_viewModel, vm))
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
        }));
    }
}
