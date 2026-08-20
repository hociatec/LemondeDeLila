#pragma once

#include "shared/text/UiTextCatalog.h"

namespace lila::shared::text::ui
{
inline constexpr UiTextRef LoginInputUsernameRequired{UiTextKey::LoginInputUsernameRequired};
inline constexpr UiTextRef LoginInputPasswordRequired{UiTextKey::LoginInputPasswordRequired};
inline constexpr UiTextRef RegisterInputUsernameRequired{UiTextKey::RegisterInputUsernameRequired};
inline constexpr UiTextRef RegisterInputEmailRequired{UiTextKey::RegisterInputEmailRequired};
inline constexpr UiTextRef RegisterInputPasswordRequired{UiTextKey::RegisterInputPasswordRequired};
inline constexpr UiTextRef AuthenticationSuccessMessage{UiTextKey::AuthenticationSuccessMessage};
inline constexpr UiTextRef RegistrationSuccessMessage{UiTextKey::RegistrationSuccessMessage};
inline constexpr UiTextRef KeyboardNavigationHint{UiTextKey::KeyboardNavigationHint};
inline constexpr UiTextRef VerticalMenuIndexOutOfRange{UiTextKey::VerticalMenuIndexOutOfRange};
}
