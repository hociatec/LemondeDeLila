using System;
using System.Collections.Generic;
using System.Linq;
using client_win.Core;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private static List<string> ParsePermissions(string? raw)
    {
        var separators = new[] { '\r', '\n', ',', ';' };
        return (raw ?? string.Empty)
            .Split(separators, StringSplitOptions.RemoveEmptyEntries)
            .Select(p => p.Trim())
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private void InitializePermissionModules(IEnumerable<string>? permissions)
    {
        var remaining = new HashSet<string>(permissions ?? Enumerable.Empty<string>(), StringComparer.OrdinalIgnoreCase);
        _permissionModules.Clear();
        foreach (var descriptor in PermissionModuleDescriptors)
        {
            var state = new PermissionModuleState(descriptor);
            state.Read = remaining.Remove(state.ReadPermission);
            state.Write = remaining.Remove(state.WritePermission);
            state.Delete = remaining.Remove(state.DeletePermission);
            _permissionModules.Add(state);
        }

        var extras = remaining.OrderBy(p => p, StringComparer.OrdinalIgnoreCase).ToList();
        AdditionalPermissions = extras.Count > 0 ? string.Join(Environment.NewLine, extras) : string.Empty;
        OnPropertyChanged(nameof(PermissionModules));
    }

    public sealed class PermissionModuleState : ObservableObject
    {
        private bool _read;
        private bool _write;
        private bool _delete;

        public PermissionModuleState(PermissionModuleDescriptor descriptor)
        {
            Descriptor = descriptor;
        }

        public PermissionModuleDescriptor Descriptor { get; }

        public string DisplayName => Descriptor.DisplayName;

        public string Description => Descriptor.Description;

        public string ModuleId => Descriptor.ModuleId;

        public string ReadPermission => $"{ModuleId}.read";

        public string WritePermission => $"{ModuleId}.write";

        public string DeletePermission => $"{ModuleId}.delete";

        public string ReadLabel => $"Lecture {DisplayName}";
        public string WriteLabel => $"Écriture {DisplayName}";
        public string DeleteLabel => $"Suppression {DisplayName}";

        public bool Read
        {
            get => _read;
            set => SetProperty(ref _read, value);
        }

        public bool Write
        {
            get => _write;
            set => SetProperty(ref _write, value);
        }

        public bool Delete
        {
            get => _delete;
            set => SetProperty(ref _delete, value);
        }

        public IEnumerable<string> SelectedPermissions
        {
            get
            {
                if (Read) yield return ReadPermission;
                if (Write) yield return WritePermission;
                if (Delete) yield return DeletePermission;
            }
        }
    }
}
