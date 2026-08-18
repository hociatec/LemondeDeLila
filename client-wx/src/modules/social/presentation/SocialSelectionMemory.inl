#include "modules/social/presentation/SocialSelectionMemory.h"
namespace lila::modules::social::presentation
{
void SocialSelectionMemory::Store(SocialSection section, std::optional<std::size_t> selection)
{
    selections_[SocialSectionIndex(section)] = selection;
}
std::optional<std::size_t> SocialSelectionMemory::Get(SocialSection section) const
{
    return selections_[SocialSectionIndex(section)];
}
std::optional<std::size_t> SocialSelectionMemory::Restore(SocialSection section, std::size_t itemCount) const
{
    const auto selection = Get(section);
    if (selection.has_value() && *selection < itemCount)
        return selection;
    if (itemCount > 0)
        return std::size_t{0};
    return std::nullopt;
}
}
