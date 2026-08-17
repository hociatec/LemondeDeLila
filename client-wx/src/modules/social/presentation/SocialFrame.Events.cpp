#include "modules/social/presentation/SocialFrame.h"

#include <array>
#include <stdexcept>

#include <wx/button.h>
#include <wx/choice.h>
#include <wx/defs.h>
#include <wx/event.h>
#include <wx/textctrl.h>

#include "modules/social/application/SocialService.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/ui/navigation/MenuBlueprint.h"
#include "shared/errors/ErrorMessages.h"

namespace
{
wxWindow* FirstFocusable(std::initializer_list<wxWindow*> candidates)
{
    for (wxWindow* candidate : candidates)
    {
        if (candidate != nullptr && candidate->IsShown() && candidate->IsEnabled())
        {
            return candidate;
        }
    }

    return nullptr;
}

wxWindow* LastFocusable(std::initializer_list<wxWindow*> candidates)
{
    wxWindow* last = nullptr;
    for (wxWindow* candidate : candidates)
    {
        if (candidate != nullptr && candidate->IsShown() && candidate->IsEnabled())
        {
            last = candidate;
        }
    }

    return last;
}

bool IsSameWindow(wxWindow* left, wxWindow* right)
{
    return left != nullptr && right != nullptr && left == right;
}
}

namespace lila::modules::social::presentation
{
void SocialFrame::BindEvents()
{
    BindMenuEvents();
    BindFriendsEvents();
    BindIncomingRequestsEvents();
    BindOutgoingRequestsEvents();
    BindBlockedUsersEvents();
    BindProfileEvents();

    Bind(
        wxEVT_CHAR_HOOK,
        [this](wxKeyEvent& event)
        {
            try
            {
                if (event.GetKeyCode() == WXK_ESCAPE)
                {
                    const wxWindow* focused = FindFocus();
                    if (currentSection_ != Section::Profile || profileEditorMode_ != ProfileEditorMode::Menu)
                    {
                        wxWindow* currentActionControl = GetCurrentSectionActionControl();
                        if (focused != nullptr && focused == currentActionControl)
                        {
                            wxWindow* sectionList = GetCurrentSectionList();
                            if (sectionList != nullptr)
                            {
                                sectionList->SetFocus();
                                return;
                            }
                        }
                    }

                    HandleEscape();
                    return;
                }

                if (event.GetKeyCode() == WXK_TAB)
                {
                    if (currentScreen_ == Screen::Menu)
                    {
                        return;
                    }

                    if (currentSection_ == Section::Profile && profileEditorMode_ == ProfileEditorMode::Menu)
                    {
                        return;
                    }

                    if (currentSection_ == Section::Friends || currentSection_ == Section::Blocked)
                    {
                        return;
                    }

                    HandleTabNavigation(event.ShiftDown());
                    return;
                }

                if ((event.GetKeyCode() == WXK_RETURN || event.GetKeyCode() == WXK_NUMPAD_ENTER) && currentScreen_ == Screen::Section)
                {
                    wxWindow* focused = FindFocus();
                    if (currentSection_ == Section::Profile && profileEditorMode_ == ProfileEditorMode::Menu &&
                        focused != nullptr && focused->GetParent() == profileMenu_)
                    {
                        ActivateProfileEditorSelection();
                        return;
                    }

                    if (
                        currentSection_ == Section::Friends &&
                        friendsList_ != nullptr &&
                        IsSameWindow(focused, friendsList_->GetFirstButton()))
                    {
                        FocusCurrentSectionActionMenu();
                        return;
                    }

                    if (
                        currentSection_ == Section::IncomingRequests &&
                        incomingRequestsList_ != nullptr &&
                        IsSameWindow(focused, incomingRequestsList_->GetFirstButton()))
                    {
                        FocusCurrentSectionActionMenu();
                        return;
                    }

                    if (
                        currentSection_ == Section::OutgoingRequests &&
                        outgoingRequestsList_ != nullptr &&
                        IsSameWindow(focused, outgoingRequestsList_->GetFirstButton()))
                    {
                        FocusCurrentSectionActionMenu();
                        return;
                    }

                    if (
                        currentSection_ == Section::Blocked &&
                        blockedUsersList_ != nullptr &&
                        IsSameWindow(focused, blockedUsersList_->GetFirstButton()))
                    {
                        FocusCurrentSectionActionMenu();
                        return;
                    }
                }

                if ((event.GetKeyCode() == WXK_RETURN || event.GetKeyCode() == WXK_NUMPAD_ENTER) &&
                    currentScreen_ == Screen::Menu)
                {
                    ActivateSelectedMenu();
                    return;
                }
            }
            catch (const std::exception& error)
            {
                UpdateStatus(wxString::FromUTF8(error.what()), true);
                return;
            }

            event.Skip();
        });

    Bind(
        wxEVT_CLOSE_WINDOW,
        [this](wxCloseEvent& event)
        {
            isClosing_ = true;
            if (event.CanVeto())
            {
                event.Veto();
            }

            if (onExitRequested_)
            {
                onExitRequested_();
            }
        });
}

void SocialFrame::BindMenuEvents()
{
    lila::shared::ui::navigation::BindMenuHandlers(
        *menu_,
        [this](std::size_t index)
        {
            lastMenuIndex_ = index;
        },
        [this](std::size_t index)
        {
            RunUiAction(
                [this, index]()
                {
                    ActivateMenuIndex(index);
                });
        });

    if (profileMenu_ != nullptr)
    {
        profileMenu_->SetActivatedHandler(
            [this](std::size_t)
            {
                RunUiAction(
                    [this]()
                    {
                        ActivateProfileEditorSelection();
                    });
                });
    }
}

void SocialFrame::BindFriendsEvents()
{
    BindSectionSelectionRefresh(*friendsList_);
    if (friendsActionsMenu_ != nullptr)
    {
        friendsActionsMenu_->SetActivatedHandler(
            [this](std::size_t actionIndex)
            {
                RunUiAction(
                    [this, actionIndex]()
                    {
                        ActivateFriendAction(actionIndex);
                    });
            });
    }

    friendsList_->SetActivatedHandler(
        [this](std::size_t)
        {
            RunUiAction(
                [this]()
                {
                    FocusCurrentSectionActionMenu();
                });
        });
}

void SocialFrame::BindIncomingRequestsEvents()
{
    BindSectionSelectionRefresh(*incomingRequestsList_);
    if (incomingActionsMenu_ != nullptr)
    {
        incomingActionsMenu_->SetActivatedHandler(
            [this](std::size_t actionIndex)
            {
                RunUiAction(
                    [this, actionIndex]()
                    {
                        ActivateIncomingAction(actionIndex);
                    });
            });
    }

    incomingRequestsList_->SetActivatedHandler(
        [this](std::size_t)
        {
            RunUiAction(
                [this]()
                {
                    FocusCurrentSectionActionMenu();
                });
        });
}

void SocialFrame::BindOutgoingRequestsEvents()
{
    BindSectionSelectionRefresh(*outgoingRequestsList_);
    if (outgoingActionsMenu_ != nullptr)
    {
        outgoingActionsMenu_->SetActivatedHandler(
            [this](std::size_t actionIndex)
            {
                RunUiAction(
                    [this, actionIndex]()
                    {
                        ActivateOutgoingAction(actionIndex);
                    });
            });
    }

    outgoingRequestsList_->SetActivatedHandler(
        [this](std::size_t)
        {
            RunUiAction(
                [this]()
                {
                    FocusCurrentSectionActionMenu();
                });
        });
}

void SocialFrame::BindBlockedUsersEvents()
{
    BindSectionSelectionRefresh(*blockedUsersList_);
    if (blockedActionsMenu_ != nullptr)
    {
        blockedActionsMenu_->SetActivatedHandler(
            [this](std::size_t actionIndex)
            {
                RunUiAction(
                    [this, actionIndex]()
                    {
                        ActivateBlockedAction(actionIndex);
                    });
            });
    }

    blockedUsersList_->SetActivatedHandler(
        [this](std::size_t)
        {
            RunUiAction(
                [this]()
                {
                    FocusCurrentSectionActionMenu();
                });
        });
}

void SocialFrame::BindProfileEvents()
{
    profileSaveButton_->Bind(
        wxEVT_BUTTON,
        [this](wxCommandEvent&)
        {
            RunUiAction([this]() { SaveProfile(); });
        });
    profileCancelButton_->Bind(
        wxEVT_BUTTON,
        [this](wxCommandEvent&)
        {
            if (profileEditorMode_ == ProfileEditorMode::Menu)
            {
                HandleEscape();
                return;
            }

            ExitProfileEditMode();
        });

    BindProfileEditorTabNavigation(*profileBioCtrl_);
    BindProfileEditorTabNavigation(*profileVictoryCtrl_);
    BindProfileEditorTabNavigation(*profileDefeatCtrl_);
    BindProfileEditorTabNavigation(*profileVisibilityChoice_);
    BindProfileEditorTabNavigation(*profileSaveButton_);
    BindProfileEditorTabNavigation(*profileCancelButton_);
}

void SocialFrame::BindSectionSelectionRefresh(lila::shared::ui::controls::VerticalMenu& list)
{
    list.SetSelectionChangedHandler(
        [this](std::size_t)
        {
            RunUiAction(
                [this]()
                {
                    SyncSelectionState();
                });
        });
}

void SocialFrame::OpenSelectedProfile()
{
    const auto userId = GetSelectedUserId();
    if (!userId.has_value())
    {
        UpdateStatus(wxString::FromUTF8(lila::shared::errors::SocialSelectPlayerToAct), true);
        return;
    }

    returnSectionFromProfile_ = currentSection_;
    LoadProfile(*userId);
    SetSection(Section::Profile, true);
}

void SocialFrame::ActivateFriendAction(std::size_t actionIndex)
{
    if (actionIndex == 0)
    {
        OpenSelectedProfile();
        return;
    }

    const std::size_t selection = friendsList_->GetSelectedIndex();
    if (selection >= friends_.size() || friendsList_->GetItemCount() == 0)
    {
        return;
    }

    const int userId = friends_[selection].id;
    const bool isBlocked = IsBlockedUser(userId);
    if (actionIndex == 1)
    {
        RunBackgroundTask(
            wxString::FromUTF8(lila::shared::errors::SocialProfileRemoveBusy),
            [this, userId]()
            {
                socialService_.RemoveFriend(userId);
            },
            [this]()
            {
                ShowActionFeedback(wxString::FromUTF8(lila::shared::errors::SocialFriendRemoved));
                LoadFriends();
            });
        return;
    }

    if (actionIndex == 2)
    {
        RunBackgroundTask(
            isBlocked ? wxString::FromUTF8(lila::shared::errors::SocialProfileActionUnblocked)
                      : wxString::FromUTF8(lila::shared::errors::SocialProfileActionBlocked),
            [this, userId, isBlocked]()
            {
                if (isBlocked)
                {
                    socialService_.UnblockUser(userId);
                    return;
                }

                socialService_.BlockUser(userId);
            },
            [this, isBlocked]()
            {
                ShowActionFeedback(wxString::FromUTF8(
                    isBlocked ? lila::shared::errors::SocialProfileUnblocked : lila::shared::errors::SocialProfileBlocked));
                LoadFriends();
            });
    }
}

void SocialFrame::ActivateIncomingAction(std::size_t actionIndex)
{
    if (actionIndex == 2)
    {
        OpenSelectedProfile();
        return;
    }

    const std::size_t selection = incomingRequestsList_->GetSelectedIndex();
    if (selection >= incomingRequests_.size() || incomingRequestsList_->GetItemCount() == 0)
    {
        return;
    }

    const int userId = incomingRequests_[selection].requester.id;
    const bool isBlocked = IsBlockedUser(userId);
    if (actionIndex == 0)
    {
        RunBackgroundTask(
            wxString::FromUTF8(lila::shared::errors::SocialProfileAcceptBusy),
            [this, userId]()
            {
                socialService_.AcceptFriend(userId);
            },
            [this]()
            {
                ShowActionFeedback(wxString::FromUTF8(lila::shared::errors::SocialProfileAccepted));
                LoadIncomingRequests();
            });
        return;
    }

    if (actionIndex == 1)
    {
        RunBackgroundTask(
            wxString::FromUTF8(lila::shared::errors::SocialProfileRejectBusy),
            [this, userId]()
            {
                socialService_.RejectFriend(userId);
            },
            [this]()
            {
                ShowActionFeedback(wxString::FromUTF8(lila::shared::errors::SocialProfileRejected));
                LoadIncomingRequests();
            });
        return;
    }

    if (actionIndex == 3)
    {
        RunBackgroundTask(
            isBlocked ? wxString::FromUTF8(lila::shared::errors::SocialProfileActionUnblocked)
                      : wxString::FromUTF8(lila::shared::errors::SocialProfileActionBlocked),
            [this, userId, isBlocked]()
            {
                if (isBlocked)
                {
                    socialService_.UnblockUser(userId);
                    return;
                }

                socialService_.BlockUser(userId);
            },
            [this, isBlocked]()
            {
                ShowActionFeedback(wxString::FromUTF8(
                    isBlocked ? lila::shared::errors::SocialProfileUnblocked : lila::shared::errors::SocialProfileBlocked));
                LoadIncomingRequests();
            });
    }
}

void SocialFrame::ActivateOutgoingAction(std::size_t actionIndex)
{
    if (actionIndex == 1)
    {
        OpenSelectedProfile();
        return;
    }

    const std::size_t selection = outgoingRequestsList_->GetSelectedIndex();
    if (selection >= outgoingRequests_.size() || outgoingRequestsList_->GetItemCount() == 0)
    {
        return;
    }

    const int userId = outgoingRequests_[selection].addressee.id;
    const bool isBlocked = IsBlockedUser(userId);
    if (actionIndex == 0)
    {
        RunBackgroundTask(
            wxString::FromUTF8(lila::shared::errors::SocialProfileCancelBusy),
            [this, userId]()
            {
                socialService_.CancelRequest(userId);
            },
            [this]()
            {
                ShowActionFeedback(wxString::FromUTF8(lila::shared::errors::SocialProfileCanceled));
                LoadOutgoingRequests();
            });
        return;
    }

    if (actionIndex == 2)
    {
        RunBackgroundTask(
            isBlocked ? wxString::FromUTF8(lila::shared::errors::SocialProfileActionUnblocked)
                      : wxString::FromUTF8(lila::shared::errors::SocialProfileActionBlocked),
            [this, userId, isBlocked]()
            {
                if (isBlocked)
                {
                    socialService_.UnblockUser(userId);
                    return;
                }

                socialService_.BlockUser(userId);
            },
            [this, isBlocked]()
            {
                ShowActionFeedback(wxString::FromUTF8(
                    isBlocked ? lila::shared::errors::SocialProfileUnblocked : lila::shared::errors::SocialProfileBlocked));
                LoadOutgoingRequests();
            });
    }
}

void SocialFrame::ActivateBlockedAction(std::size_t actionIndex)
{
    if (actionIndex != 0)
    {
        return;
    }

    const std::size_t selection = blockedUsersList_->GetSelectedIndex();
    if (selection >= blockedUsers_.size() || blockedUsersList_->GetItemCount() == 0)
    {
        return;
    }

    const int userId = blockedUsers_[selection].id;
    RunBackgroundTask(
        wxString::FromUTF8(lila::shared::errors::SocialProfileActionUnblocked),
        [this, userId]()
        {
            socialService_.UnblockUser(userId);
        },
        [this]()
        {
            ShowActionFeedback(wxString::FromUTF8(lila::shared::errors::SocialProfileUnblocked));
            LoadBlockedUsers();
        });
}

void SocialFrame::FocusCurrentSectionActionMenu()
{
    wxWindow* actionControl = GetCurrentSectionActionControl();
    if (actionControl != nullptr && actionControl->IsEnabled())
    {
        actionControl->SetFocus();
        return;
    }

    wxWindow* listControl = GetCurrentSectionList();
    if (listControl != nullptr)
    {
        listControl->SetFocus();
    }
}

void SocialFrame::BindProfileEditorTabNavigation(wxWindow& window)
{
    window.Bind(
        wxEVT_NAVIGATION_KEY,
        [this](wxNavigationKeyEvent& event)
        {
            if (currentSection_ == Section::Profile && profileEditorMode_ != ProfileEditorMode::Menu)
            {
                FocusProfileEditorControl(!event.GetDirection());
                return;
            }

            event.Skip();
        });

    const auto handleTab = [this](wxKeyEvent& event) -> bool
    {
        if (currentSection_ == Section::Profile && profileEditorMode_ != ProfileEditorMode::Menu &&
            event.GetKeyCode() == WXK_TAB)
        {
            FocusProfileEditorControl(event.ShiftDown());
            return true;
        }

        return false;
    };

    window.Bind(
        wxEVT_KEY_DOWN,
        [handleTab](wxKeyEvent& event)
        {
            if (handleTab(event))
            {
                return;
            }

            event.Skip();
        });
    window.Bind(
        wxEVT_CHAR_HOOK,
        [handleTab](wxKeyEvent& event)
        {
            if (handleTab(event))
            {
                return;
            }

            event.Skip();
        });
}

void SocialFrame::FocusProfileEditorControl(bool reverse)
{
    const std::array<wxWindow*, 3> focusOrder = {
        GetFirstFocusableInCurrentScreen(),
        profileSaveButton_,
        profileCancelButton_,
    };

    wxWindow* focused = FindFocus();
    bool hasFocusOrder = false;
    for (wxWindow* candidate : focusOrder)
    {
        if (candidate != nullptr && candidate == focused)
        {
            hasFocusOrder = true;
            break;
        }
    }

    if (!hasFocusOrder)
    {
        (reverse ? profileCancelButton_ : focusOrder.front())->SetFocus();
        return;
    }

    std::size_t currentIndex = 0;
    while (currentIndex < focusOrder.size() && focusOrder[currentIndex] != focused)
    {
        ++currentIndex;
    }

    if (currentIndex >= focusOrder.size())
    {
        (reverse ? profileCancelButton_ : focusOrder.front())->SetFocus();
        return;
    }

    const std::size_t nextIndex = reverse
        ? (currentIndex == 0 ? focusOrder.size() - 1 : currentIndex - 1)
        : (currentIndex + 1) % focusOrder.size();

    if (focusOrder[nextIndex] != nullptr && focusOrder[nextIndex]->IsShown() && focusOrder[nextIndex]->IsEnabled())
    {
        focusOrder[nextIndex]->SetFocus();
    }
}

void SocialFrame::HandleTabNavigation(bool reverse)
{
    if (currentScreen_ == Screen::Menu)
    {
        return;
    }

    if (currentSection_ == Section::Friends || currentSection_ == Section::Blocked)
    {
        return;
    }

    if (currentSection_ == Section::Profile && profileEditorMode_ == ProfileEditorMode::Menu)
    {
        return;
    }

    const bool allowTabLoop =
        currentSection_ != Section::Profile ||
        (currentProfile_.has_value() && currentProfile_->isOwner);
    if (!allowTabLoop)
    {
        return;
    }

    wxWindow* first = GetFirstFocusableInCurrentScreen();
    wxWindow* last = GetLastFocusableInCurrentScreen();
    wxWindow* focused = FindFocus();

    if (first == nullptr || last == nullptr)
    {
        return;
    }

    if (focused == nullptr)
    {
        (reverse ? last : first)->SetFocus();
        return;
    }

    if (!reverse && focused == last)
    {
        first->SetFocus();
        return;
    }

    if (reverse && focused == first)
    {
        last->SetFocus();
        return;
    }

    wxWindow* parent = focused;
    while (parent != nullptr)
    {
        if (parent == this)
        {
            break;
        }

        parent = parent->GetParent();
    }

    if (parent == nullptr)
    {
        (reverse ? last : first)->SetFocus();
    }
}

void SocialFrame::FocusCurrentScreen()
{
    if (currentScreen_ == Screen::Menu)
    {
        menu_->SetSelectedIndex(lastMenuIndex_);
        menu_->FocusSelectedItem();
        return;
    }

    switch (currentSection_)
    {
    case Section::Friends:
        if (friendsList_->GetItemCount() > 0)
        {
            if (friendsList_->GetSelectedIndex() >= friendsList_->GetItemCount())
            {
                friendsList_->SetSelectedIndex(0);
                SyncSelectionState();
            }
            if (wxWindow::FindFocus() != friendsList_->GetFirstButton())
            {
                friendsList_->FocusSelectedItem();
            }
        }
        else
        {
            if (wxWindow::FindFocus() != emptyFriendsCtrl_)
            {
                emptyFriendsCtrl_->SetFocus();
            }
        }
        return;
    case Section::IncomingRequests:
        if (incomingRequestsList_->GetItemCount() > 0)
        {
            if (incomingRequestsList_->GetSelectedIndex() >= incomingRequestsList_->GetItemCount())
            {
                incomingRequestsList_->SetSelectedIndex(0);
                SyncSelectionState();
            }
            if (wxWindow::FindFocus() != incomingRequestsList_->GetFirstButton())
            {
                incomingRequestsList_->FocusSelectedItem();
            }
        }
        else
        {
            if (wxWindow::FindFocus() != emptyIncomingRequestsCtrl_)
            {
                emptyIncomingRequestsCtrl_->SetFocus();
            }
        }
        return;
    case Section::OutgoingRequests:
        if (outgoingRequestsList_->GetItemCount() > 0)
        {
            if (outgoingRequestsList_->GetSelectedIndex() >= outgoingRequestsList_->GetItemCount())
            {
                outgoingRequestsList_->SetSelectedIndex(0);
                SyncSelectionState();
            }
            if (wxWindow::FindFocus() != outgoingRequestsList_->GetFirstButton())
            {
                outgoingRequestsList_->FocusSelectedItem();
            }
        }
        else
        {
            if (wxWindow::FindFocus() != emptyOutgoingRequestsCtrl_)
            {
                emptyOutgoingRequestsCtrl_->SetFocus();
            }
        }
        return;
    case Section::Blocked:
        if (blockedUsersList_->GetItemCount() > 0)
        {
            if (blockedUsersList_->GetSelectedIndex() >= blockedUsersList_->GetItemCount())
            {
                blockedUsersList_->SetSelectedIndex(0);
                SyncSelectionState();
            }
            if (wxWindow::FindFocus() != blockedUsersList_->GetFirstButton())
            {
                blockedUsersList_->FocusSelectedItem();
            }
        }
        else
        {
            if (wxWindow::FindFocus() != emptyBlockedUsersCtrl_)
            {
                emptyBlockedUsersCtrl_->SetFocus();
            }
        }
        return;
    case Section::Profile:
        switch (profileEditorMode_)
        {
        case ProfileEditorMode::Menu:
            if (profileMenu_ != nullptr)
            {
                profileMenu_->FocusSelectedItem();
            }
            else
            {
                profileInfoCtrl_->SetFocus();
            }
            return;
        case ProfileEditorMode::Bio:
            profileBioCtrl_->SetFocus();
            return;
        case ProfileEditorMode::VictoryMessage:
            profileVictoryCtrl_->SetFocus();
            return;
        case ProfileEditorMode::DefeatMessage:
            profileDefeatCtrl_->SetFocus();
            return;
        case ProfileEditorMode::Visibility:
            profileVisibilityChoice_->SetFocus();
            return;
        }
        return;
    }
}

wxWindow* SocialFrame::GetFirstFocusableInCurrentScreen() const
{
    if (currentScreen_ == Screen::Menu)
    {
        return menu_ != nullptr ? menu_->GetFirstButton() : nullptr;
    }

    switch (currentSection_)
    {
    case Section::Friends:
        return FirstFocusable(
            {
                friendsList_->GetItemCount() > 0 ? static_cast<wxWindow*>(friendsList_->GetFirstButton())
                                                 : static_cast<wxWindow*>(emptyFriendsCtrl_),
                friendsActionsMenu_ != nullptr ? static_cast<wxWindow*>(friendsActionsMenu_->GetFirstButton()) : nullptr,
            });
    case Section::IncomingRequests:
        return FirstFocusable(
            {
                incomingRequestsList_->GetItemCount() > 0
                    ? static_cast<wxWindow*>(incomingRequestsList_->GetFirstButton())
                    : static_cast<wxWindow*>(emptyIncomingRequestsCtrl_),
                incomingActionsMenu_ != nullptr ? static_cast<wxWindow*>(incomingActionsMenu_->GetFirstButton()) : nullptr,
            });
    case Section::OutgoingRequests:
        return FirstFocusable(
            {
                outgoingRequestsList_->GetItemCount() > 0
                    ? static_cast<wxWindow*>(outgoingRequestsList_->GetFirstButton())
                    : static_cast<wxWindow*>(emptyOutgoingRequestsCtrl_),
                outgoingActionsMenu_ != nullptr ? static_cast<wxWindow*>(outgoingActionsMenu_->GetFirstButton()) : nullptr,
            });
    case Section::Blocked:
        return FirstFocusable(
            {
                blockedUsersList_->GetItemCount() > 0 ? static_cast<wxWindow*>(blockedUsersList_->GetFirstButton())
                                                     : static_cast<wxWindow*>(emptyBlockedUsersCtrl_),
                blockedActionsMenu_ != nullptr ? static_cast<wxWindow*>(blockedActionsMenu_->GetFirstButton()) : nullptr,
            });
    case Section::Profile:
        switch (profileEditorMode_)
        {
        case ProfileEditorMode::Menu:
            return FirstFocusable({
                profileMenu_ != nullptr ? static_cast<wxWindow*>(profileMenu_->GetFirstButton()) : nullptr,
                profileCancelButton_});
        case ProfileEditorMode::Bio:
            return FirstFocusable({profileBioCtrl_, profileSaveButton_, profileCancelButton_});
        case ProfileEditorMode::VictoryMessage:
            return FirstFocusable({profileVictoryCtrl_, profileSaveButton_, profileCancelButton_});
        case ProfileEditorMode::DefeatMessage:
            return FirstFocusable({profileDefeatCtrl_, profileSaveButton_, profileCancelButton_});
        case ProfileEditorMode::Visibility:
            return FirstFocusable({profileVisibilityChoice_, profileSaveButton_, profileCancelButton_});
        }
        return nullptr;
    }

    return nullptr;
}

wxWindow* SocialFrame::GetLastFocusableInCurrentScreen() const
{
    if (currentScreen_ == Screen::Menu)
    {
        return menu_ != nullptr ? menu_->GetLastButton() : nullptr;
    }

    switch (currentSection_)
    {
    case Section::Friends:
        return LastFocusable(
            {
                friendsList_->GetItemCount() > 0 ? static_cast<wxWindow*>(friendsList_->GetFirstButton())
                                                 : static_cast<wxWindow*>(emptyFriendsCtrl_),
                friendsActionsMenu_ != nullptr ? static_cast<wxWindow*>(friendsActionsMenu_->GetLastButton()) : nullptr,
            });
    case Section::IncomingRequests:
        return LastFocusable(
            {
                incomingRequestsList_->GetItemCount() > 0
                    ? static_cast<wxWindow*>(incomingRequestsList_->GetFirstButton())
                    : static_cast<wxWindow*>(emptyIncomingRequestsCtrl_),
                incomingActionsMenu_ != nullptr ? static_cast<wxWindow*>(incomingActionsMenu_->GetLastButton()) : nullptr,
            });
    case Section::OutgoingRequests:
        return LastFocusable(
            {
                outgoingRequestsList_->GetItemCount() > 0
                    ? static_cast<wxWindow*>(outgoingRequestsList_->GetFirstButton())
                    : static_cast<wxWindow*>(emptyOutgoingRequestsCtrl_),
                outgoingActionsMenu_ != nullptr ? static_cast<wxWindow*>(outgoingActionsMenu_->GetLastButton()) : nullptr,
            });
    case Section::Blocked:
        return LastFocusable(
            {
                blockedUsersList_->GetItemCount() > 0 ? static_cast<wxWindow*>(blockedUsersList_->GetFirstButton())
                                                     : static_cast<wxWindow*>(emptyBlockedUsersCtrl_),
                blockedActionsMenu_ != nullptr ? static_cast<wxWindow*>(blockedActionsMenu_->GetLastButton()) : nullptr,
            });
    case Section::Profile:
        switch (profileEditorMode_)
        {
        case ProfileEditorMode::Menu:
            return LastFocusable({
                profileMenu_ != nullptr ? static_cast<wxWindow*>(profileMenu_->GetLastButton()) : nullptr,
                profileCancelButton_});
        case ProfileEditorMode::Bio:
            return LastFocusable({profileBioCtrl_, profileSaveButton_, profileCancelButton_});
        case ProfileEditorMode::VictoryMessage:
            return LastFocusable({profileVictoryCtrl_, profileSaveButton_, profileCancelButton_});
        case ProfileEditorMode::DefeatMessage:
            return LastFocusable({profileDefeatCtrl_, profileSaveButton_, profileCancelButton_});
        case ProfileEditorMode::Visibility:
            return LastFocusable({profileVisibilityChoice_, profileSaveButton_, profileCancelButton_});
        }
        return nullptr;
    }

    return nullptr;
}

wxWindow* SocialFrame::GetCurrentSectionActionControl() const
{
    if (currentSection_ == Section::Profile)
    {
        return nullptr;
    }

    switch (currentSection_)
    {
    case Section::Friends:
        return friendsActionsMenu_ != nullptr ? friendsActionsMenu_->GetFirstButton() : nullptr;
    case Section::IncomingRequests:
        return incomingActionsMenu_ != nullptr ? incomingActionsMenu_->GetFirstButton() : nullptr;
    case Section::OutgoingRequests:
        return outgoingActionsMenu_ != nullptr ? outgoingActionsMenu_->GetFirstButton() : nullptr;
    case Section::Blocked:
        return blockedActionsMenu_ != nullptr ? blockedActionsMenu_->GetFirstButton() : nullptr;
    case Section::Profile:
        return nullptr;
    }

    return nullptr;
}

wxWindow* SocialFrame::GetCurrentSectionList() const
{
    if (currentSection_ == Section::Profile)
    {
        return nullptr;
    }

    switch (currentSection_)
    {
    case Section::Friends:
        return friendsList_ != nullptr ? static_cast<wxWindow*>(friendsList_->GetFirstButton()) : nullptr;
    case Section::IncomingRequests:
        return incomingRequestsList_ != nullptr ? static_cast<wxWindow*>(incomingRequestsList_->GetFirstButton()) : nullptr;
    case Section::OutgoingRequests:
        return outgoingRequestsList_ != nullptr ? static_cast<wxWindow*>(outgoingRequestsList_->GetFirstButton()) : nullptr;
    case Section::Blocked:
        return blockedUsersList_ != nullptr ? static_cast<wxWindow*>(blockedUsersList_->GetFirstButton()) : nullptr;
    case Section::Profile:
        return nullptr;
    }

    return nullptr;
}

void SocialFrame::SetScreen(Screen screen)
{
    currentScreen_ = screen;
    if (screen == Screen::Menu && menu_ != nullptr)
    {
        menu_->SetSelectedIndex(lastMenuIndex_);
    }

    FocusCurrentScreen();
}

void SocialFrame::ActivateSelectedMenu()
{
    ActivateMenuIndex(menu_->GetSelectedIndex());
}

void SocialFrame::ActivateMenuIndex(std::size_t index)
{
    lastMenuIndex_ = index;
    if (index == 0)
    {
        if (onOpenMessagingRequested_)
        {
            onOpenMessagingRequested_(lastMenuIndex_);
        }
        return;
    }

    const auto section = MenuIndexToSection(index);
    if (!section.has_value())
    {
        return;
    }

    if (*section == Section::Profile)
    {
        returnSectionFromProfile_.reset();
        LoadProfile(std::nullopt);
    }

    SetSection(*section, true);
}

void SocialFrame::ActivateProfileEditorSelection()
{
    if (!currentProfile_.has_value() || !currentProfile_->isOwner)
    {
        return;
    }

    switch (profileMenu_->GetSelectedIndex())
    {
    case 0:
        StartProfileEdit(ProfileEditorMode::Bio);
        return;
    case 1:
        StartProfileEdit(ProfileEditorMode::VictoryMessage);
        return;
    case 2:
        StartProfileEdit(ProfileEditorMode::DefeatMessage);
        return;
    case 3:
        StartProfileEdit(ProfileEditorMode::Visibility);
        return;
    default:
        return;
    }
}

void SocialFrame::HandleEscape()
{
    try
    {
        if (currentScreen_ == Screen::Section)
        {
            if (currentSection_ == Section::Profile && TryExitProfile())
            {
                return;
            }

            SetScreen(Screen::Menu);
            return;
        }

        if (onCloseRequested_)
        {
            onCloseRequested_();
        }
    }
    catch (const std::exception& error)
    {
        UpdateStatus(wxString::FromUTF8(error.what()), true);
    }
}
}
