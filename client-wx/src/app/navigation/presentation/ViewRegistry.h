#pragma once

#include <array>
#include <cstddef>

#include "app/navigation/domain/ViewId.h"

class wxWindow;

namespace lila::app::navigation
{
class ViewRegistry final
{
public:
    [[nodiscard]] wxWindow* Get(domain::ViewId viewId) const noexcept
    {
        return IsValid(viewId) ? views_[Index(viewId)] : nullptr;
    }

    void Set(domain::ViewId viewId, wxWindow* view) noexcept
    {
        if (IsValid(viewId))
        {
            views_[Index(viewId)] = view;
        }
    }

    [[nodiscard]] wxWindow* Release(domain::ViewId viewId) noexcept
    {
        if (!IsValid(viewId))
        {
            return nullptr;
        }

        auto*& slot = views_[Index(viewId)];
        auto* view = slot;
        slot = nullptr;
        return view;
    }

private:
    [[nodiscard]] static constexpr bool IsValid(domain::ViewId viewId) noexcept
    {
        return viewId != domain::ViewId::None && viewId != domain::ViewId::Count;
    }

    [[nodiscard]] static constexpr std::size_t Index(domain::ViewId viewId) noexcept
    {
        return static_cast<std::size_t>(viewId);
    }

    std::array<wxWindow*, static_cast<std::size_t>(domain::ViewId::Count)> views_{};
};
}
