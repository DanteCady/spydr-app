import { hasUnread } from '@shared/releases'
import { LATEST_RELEASE } from '../releases'
import { useApp } from '../state'

/**
 * Whether there are release notes this install has not been shown, and a way to say it has.
 *
 * The marker is a version in settings rather than a boolean, so "seen" survives a later release
 * turning it unread again — and an install that has never recorded one is quiet, because a first
 * run has nothing to have missed.
 */
export function useUnreadRelease(): { unread: boolean; markSeen: () => void } {
  const { settings, updateSettings } = useApp()
  const latest = LATEST_RELEASE?.version

  return {
    unread: hasUnread(latest, settings.updates.lastSeenRelease || undefined),
    markSeen: () => {
      if (!latest || settings.updates.lastSeenRelease === latest) return
      void updateSettings({ updates: { lastSeenRelease: latest } })
    }
  }
}
