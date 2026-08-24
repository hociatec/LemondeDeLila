#include "modules/vault/presentation/VaultPresentationModel.h"

#include <cctype>

#include <wx/datetime.h>

#include "modules/vault/presentation/VaultNavigator.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::vault::presentation
{
namespace
{
bool StartsWithGeneratedDate(std::string_view value)
{
    if (value.size() < 10 || value[2] != '/' || value[5] != '/') return false;
    constexpr std::size_t DigitPositions[]{0, 1, 3, 4, 6, 7, 8, 9};
    for (const auto position : DigitPositions)
    {
        if (std::isdigit(static_cast<unsigned char>(value[position])) == 0) return false;
    }
    return true;
}

std::string SnapshotName(const domain::VaultSnapshot& snapshot)
{
    const auto generatedSuffix = snapshot.name.rfind(", ");
    if (generatedSuffix != std::string::npos &&
        StartsWithGeneratedDate(std::string_view(snapshot.name).substr(generatedSuffix + 2)))
    {
        return snapshot.name.substr(0, generatedSuffix);
    }
    return snapshot.name;
}

wxString FormatCreatedAt(std::string_view rawCreatedAt)
{
    auto raw = lila::shared::text::FromUtf8(rawCreatedAt);
    if (raw.length() < 19) return raw;

    wxDateTime createdAt;
    if (!createdAt.ParseISOCombined(raw.Left(19))) return raw;
    if (raw.length() > 19 && raw.Last() == 'Z') createdAt.MakeFromUTC();
    return createdAt.Format(wxString(L"%d.%m.%Y %H:%M"));
}
}

std::vector<lila::shared::ui::controls::VerticalMenuItem> VaultPresentationModel::BuildItems(
    const VaultNavigator& navigator,
    bool showRetry)
{
    using Item = lila::shared::ui::controls::VerticalMenuItem;
    if (showRetry) return {Item{"retry", wxString(L"R\u00E9essayer")}};

    std::vector<Item> items;
    items.reserve(navigator.Snapshots().size());
    for (const auto& snapshot : navigator.Snapshots())
    {
        auto label = lila::shared::text::FromUtf8(SnapshotName(snapshot));
        if (!snapshot.playersLabel.empty())
            label += wxString(L" avec ") + lila::shared::text::FromUtf8(snapshot.playersLabel);
        const auto createdAt = FormatCreatedAt(snapshot.createdAt);
        if (!createdAt.empty()) label += wxString(L", ") + createdAt;
        items.push_back({snapshot.id, std::move(label)});
    }
    if (items.empty()) items.push_back({"empty", wxString(L"Aucune partie sauvegard\u00E9e")});
    return items;
}
}
