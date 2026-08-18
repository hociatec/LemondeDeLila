#include "modules/messaging/presentation/MessagingActionController.inl"
#include "modules/messaging/presentation/MessagingMailboxController.h"
#include "modules/options/presentation/OptionsEditorController.h"
#include "modules/social/presentation/SocialLoadController.h"

// Compile-only guard for presentation controllers that deliberately avoid wxWidgets.
int presentation_controller_compile_guard()
{
    return 0;
}
