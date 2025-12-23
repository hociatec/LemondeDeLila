using System;
using System.Windows.Input;
using client_win.Core;

namespace client_win.Modules.Admin.ViewModels;

/// <summary>
/// ViewModel pour le panneau d'administration.
/// TODO: Implémenter les outils d'administration (gestion utilisateurs, modération, logs).
/// </summary>
public sealed class AdminViewModel : ObservableObject
{
    private readonly Action? _onClose;
    private string _status = "Chargement du panneau d'administration...";

    public AdminViewModel(Action? onClose = null)
    {
        _onClose = onClose;
        CloseCommand = new RelayCommand(HandleClose);

        // TODO: Charger les données d'administration depuis le serveur
        Status = "Fonctionnalité réservée aux administrateurs.\nLes outils d'administration seront disponibles ici.";
    }

    public ICommand CloseCommand { get; }

    public string Status
    {
        get => _status;
        set => SetProperty(ref _status, value);
    }

    private void HandleClose()
    {
        _onClose?.Invoke();
    }
}
