# SimuF1 Data Model (Firestore)

## Collections

- simuf1Races/{raceId}
  - fields:
    - id
    - seasonYear
    - weekKey
    - sundayDateISO
    - status: draft | open | locked | simulated | published
    - createdAt
    - updatedAt
  - subcollection entries/{entryId}
    - raceId
    - seasonYear
    - userEmail
    - userPseudo
    - teamName
    - participating
    - cars[2]: pilotName, bloc, grip, audace, defense, endurance, pneus, pitStops, pitLaps[]
    - updatedAt
  - subcollection results/latest
    - raceId
    - seasonYear
    - generatedAtISO
    - generatedAt
    - cars[]: position, pilotName, teamName, ownerEmail, points, dnf, dnfLap
    - diceLogs[]: seq, phase, lap, actor/target, stat, roll, threshold, success, summary

- simuf1Seasons/{year}
  - fields:
    - seasonYear
    - teams: map<teamName, points>
    - drivers: map<pilotName, points>
    - updatedAt

## UI views backed by this model

- Home: next race CTA + live standings filtered by current participants.
- Championship detail: list of all races in season (`simuf1Races` by `sundayDateISO`).
- Grand Prix detail: one race result + full reverse-chronological dice log history.

## Race lifecycle

1. open: players edit participation and setups
2. locked: entries frozen
3. simulated: calculation done
4. published: result + standings visible

## Notes

- The current implementation supports one active weekly race and stores full race history.
- Team and driver standings are cumulative and season scoped.
- All SimuF1 data is isolated under SimuF1 collections and files in this directory.
