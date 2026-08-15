# Pet Seen — UI interaction flow

This map connects the implemented screens and records their delivery status from the [project breakdown](PROJECT_BREAKDOWN.md). Green screens can be tested now. Amber screens are present but their tracker task is still in progress. Grey dashed paths are planned follow-up work and are not available to test yet. Global navigation (Home, Nearby and language selection) is available wherever the full site header is shown.

## Keeping this map current

- The release tables in the project breakdown remain the source of truth for each `PS-*` task. Update the task status there first, then change the matching node's status text and class in this map.
- Add each new screen as one node using a short, stable ID and the format `ID["Screen name\nStatus · PS-###"]:::status`.
- Connect nodes with a labelled arrow for each user action. Use `-.->` only for a planned flow that is not available in the UI yet.
- Use `:::done`, `:::progress` or `:::planned`; the colour definitions at the top of the diagram should not need changing.
- Keep non-screen outcomes (receipts, offline drafts and email notifications) as separate nodes only when they change what someone can test or do next.

```mermaid
flowchart TB
  classDef done fill:#dff3e9,stroke:#24805a,color:#163c2d
  classDef progress fill:#fff0d8,stroke:#c57518,color:#633b09
  classDef planned fill:#edf0f4,stroke:#748092,color:#354052,stroke-dasharray: 5 3
  classDef neutral fill:#f8f9fb,stroke:#a9b1bd,color:#303743

  Global["Global header\nHome · Nearby · language"]:::neutral
  Home["Home / nearby list or map\nDone · PS-303"]:::done
  Auth["Magic-link sign in\nIn progress · PS-101"]:::progress
  Dashboard["Owner dashboard\nDone · PS-108"]:::done
  Missing["Create missing case\nIn progress · PS-105"]:::progress
  MissingLocation["Set GPS / move pin / manual location\nIn progress · PS-105"]:::progress
  Public["Public missing-case page\nDone · PS-106–107"]:::done
  Poster["Poster + QR / print\nDone · PS-301"]:::done
  Share["Copy, Web Share or WhatsApp\nDone · PS-302"]:::done
  ReportContent["Report public-case content\nDone · PS-109"]:::done
  Sighting["Anonymous sighting form\nDone · PS-201, PS-207"]:::done
  Picker["Optional case picker\nDone · PS-202"]:::done
  SightingSuccess["Sighting receipt\nDone"]:::done
  Draft["Offline draft / restore / retry\nDone · PS-207"]:::done
  Notify["Linked-sighting owner email\nDone · PS-204"]:::done
  Timeline["Owner sighting timeline + exact map\nDone · PS-203, PS-205"]:::done
  Found["Found-pet report + optional photo\nDone · PS-402, PS-410"]:::done
  FoundReceipt["Found-report receipt\nDone"]:::done
  Moderation["Staff moderation queue\nDone · PS-109, PS-411"]:::done
  Match["Deterministic candidate matching\nDone · PS-403"]:::done
  OwnerMatch["Owner: confirm or decline match\nDone · PS-403"]:::done
  Reunite["Mark reunited / close / remove / edit\nDone · PS-108, PS-206"]:::done
  NotFound["Not-found screen\nDone"]:::neutral
  FollowUp["Reporter magic-link follow-up\nNot started · PS-404"]:::planned
  Watch["Watch area and push / email alerts\nDone · PS-405"]:::done
  Lifecycle["Expiry, reopen and data housekeeping\nDone · PS-406"]:::done
  Hardening["Accessibility and security hardening\nDone · PS-407"]:::done
  ProductionHardening["Production monitoring and launch hardening\nNot started · PS-412"]:::planned
  AI["AI candidate scoring with staff review\nIn progress · PS-408"]:::progress
  MatchNormalization["Normalized breed and colour matching\nNot started · PS-413"]:::planned
  PublicSightings["Public approximate sighting list\nNot started · PS-409"]:::planned
  Deploy["Post-deploy regression run and alerts\nIn progress · PS-307"]:::progress

  Global --> Home
  Global -->|"Signed-in account"| Dashboard
  Home -->|"I lost a pet"| Missing
  Home -->|"I saw a pet"| Sighting
  Home -->|"I found a pet"| Found
  Home -->|"Open nearby case"| Public
  Home -->|"Sign in"| Auth
  Auth -->|"Signed in"| Dashboard
  Dashboard -->|"New case"| Missing
  Missing -->|"Not signed in"| Auth
  Missing -->|"Save pet details"| MissingLocation
  MissingLocation -->|"Save and publish"| Dashboard
  Dashboard -->|"View public case"| Public
  Public -->|"Report a sighting"| Sighting
  Public -->|"Create poster"| Poster
  Public -->|"Share / copy / WhatsApp"| Share
  Public -->|"Report content"| ReportContent
  Poster -->|"QR or back"| Public
  Share -->|"Recipient opens link"| Public
  ReportContent -->|"Staff review"| Moderation
  Sighting -->|"Choose a case"| Picker
  Picker -->|"Select case or no match"| Sighting
  Sighting -->|"Offline or failed submit"| Draft
  Draft -->|"Reconnect and retry"| Sighting
  Sighting -->|"Submit"| SightingSuccess
  SightingSuccess -->|"Back home"| Home
  SightingSuccess -->|"Linked report"| Notify
  Notify --> Timeline
  Timeline -->|"Confirm or dismiss"| Dashboard
  Dashboard -->|"Mark reunited / close / edit / remove"| Reunite
  Reunite --> Dashboard
  Found -->|"Submit"| FoundReceipt
  FoundReceipt -->|"Private screening"| Moderation
  Moderation -->|"Approve report"| Match
  Moderation -->|"Reject report"| FoundReceipt
  Match -->|"Link close candidate"| OwnerMatch
  OwnerMatch -->|"Confirm or decline"| Dashboard
  NotFound -->|"Go home"| Home
  FoundReceipt -.-> FollowUp
  Dashboard -.-> Watch
  Moderation -->|"Resolve, expire, reopen or delete"| Lifecycle
  Moderation --> AI
  Found -.-> MatchNormalization
  Home -.-> PublicSightings
  Deploy --> Hardening
  Hardening -.-> ProductionHardening
  Deploy -.->|"Protects all deployed flows"| Home
```
