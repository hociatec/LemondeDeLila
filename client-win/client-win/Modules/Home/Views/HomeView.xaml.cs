using System;
using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
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

    private void FocusFirstField()
    {
        if (_viewModel == null)
        {
            return;
        }

        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            switch (_viewModel.CurrentPage)
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
