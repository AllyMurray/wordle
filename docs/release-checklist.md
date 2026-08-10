# Release validation checklist

Automation covers the production build, supported browser engines, emulated
mobile layouts, multiplayer state synchronization, accessibility rules, and
service-worker upgrades. Complete these human or infrastructure-dependent
checks before a major release.

## Physical devices and networks

- Install the PWA on a current iPhone and Android device.
- Launch it from the home screen, play both games, background it, and resume it.
- Connect two physical devices on different networks (for example Wi-Fi and
  cellular) and complete one Wordle and one Boggle multiplayer session.
- Repeat behind a restrictive office or guest network when available.
- Confirm the public PeerJS signalling service is reachable from the deployed
  origin and that a signalling outage produces a visible, recoverable error.

## Assistive technology

- Complete Wordle using VoiceOver on Safari and NVDA or JAWS on a Chromium
  browser.
- Complete Boggle selection, submission, board rotation, and game ending using
  keyboard controls only.
- Confirm live announcements are useful without becoming repetitive.
- Verify focus returns correctly after closing statistics and update dialogs.

## Visual and installation review

- Inspect light and dark themes at 100%, 200%, and 400% browser zoom.
- Check portrait and landscape layouts on the smallest supported phone.
- Confirm install icons, splash presentation, theme colour, and standalone
  navigation on both mobile platforms.
- Upgrade an already-installed production version and confirm statistics remain
  intact after accepting the update.
