#include "shared/text/Encoding.h"
#include "modules/home/presentation/HomeFrame.h"

#include "modules/user/application/LoginUseCase.h"
#include "modules/user/application/RegisterUseCase.h"
#include "shared/config/AppConfig.h"

namespace
{
constexpr int WindowWidth = 1280;
constexpr int WindowHeight = 720;
}

namespace lila::modules::home::presentation
{
HomeFrame::HomeFrame(
    wxWindow* parent,
    user::application::LoginUseCase& loginUseCase,
    user::application::RegisterUseCase& registerUseCase,
    LoginSucceededHandler onLoginSucceeded)
    : lila::shared::accessibility::NonFocusablePanel(
          parent,
          0),
      loginUseCase_(loginUseCase),
      registerUseCase_(registerUseCase),
      onLoginSucceeded_(std::move(onLoginSucceeded))
{
    SetMinSize(wxSize(WindowWidth, WindowHeight));
    BuildLayout();
    ApplyTheme();
    BindEvents();
    ShowPage(Page::Landing);
    StartAuthenticationWarmUp();
}
}
