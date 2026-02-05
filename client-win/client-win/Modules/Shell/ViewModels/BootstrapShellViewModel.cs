using System;
using client_win.Core;

namespace client_win.Modules.Shell.ViewModels;

// Lightweight shell shown immediately at app startup while the real DI host is built.
public sealed class BootstrapShellViewModel : ObservableObject
{
    private string _windowTitle = "Le Monde de Lila";
    private string _status = "Demarrage...";

    public string WindowTitle
    {
        get => _windowTitle;
        set => SetProperty(ref _windowTitle, value ?? "Le Monde de Lila");
    }

    // MainWindow.RootHost binds to CurrentContent. We point to ourselves to reuse a single DataTemplate.
    public object CurrentContent => this;

    public string Status
    {
        get => _status;
        set => SetProperty(ref _status, value ?? string.Empty);
    }

    public void SetError(string message)
    {
        Status = string.IsNullOrWhiteSpace(message) ? "Erreur au demarrage." : message.Trim();
    }
}

