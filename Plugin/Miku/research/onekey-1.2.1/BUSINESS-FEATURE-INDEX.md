# QQPet 1.2.1 business feature index

All symbols below are in `index.business.mjs`.

## Configuration and persistence

- `DEFAULT_CONFIG_VALUES` and `normalizeConfig`: defaults, migrations, and bounds.
- `ProgressStore`: daily counters, pending task/PK state, visited targets,
  attribute baseline, and money-bag streak.

## Protocol client

- `READ_PACKETS`: all read-only OneBot packet descriptors.
- `QQPetApi`: protobuf request construction and response decoding.
- `queryInteractionMessages`: interaction-event history.
- `queryOutdoorRecords`: outdoor-history records and result items.
- `queryPetFriendRecords` / `queryPetFriendDirectory`: friends and other players.
- `visitOther`, `queryStompStatus`, `stompOther`: visit and stomp operations.
- `encourageSchool`: encouragement for an active school story.
- `queryPkPower`, `startPk`, `settlePk`: PK discovery and lifecycle.
- `startSchool`, `startWork`, `startAdventure`, `settleStory`: task lifecycle.

The 1.2.1 release no longer embeds the write-packet command table in JavaScript.
`sendProtectedOidb` passes an operation name and protobuf body to the injected
write executor. This extraction preserves that boundary and does not contain
the protected native transport.

## Automation

- `isRestPeriodActive`: cross-midnight quiet period.
- `updateAdventureMoneyBagStreak` / `shouldPauseAdventureForNoMoneyBag`:
  money-bag outcome tracking.
- `AutomationController.maybeVisit`: friend/stranger visits and optional care.
- `AutomationController.maybePk`: candidate scanning, power filtering, start,
  delayed settlement, and daily accounting.
- `AutomationController.maybeEncourageSchool`: one-time encouragement.
- `AutomationController.handleStory`: task confirmation and settlement.
- `AutomationController.runOnce`: complete decision loop.
