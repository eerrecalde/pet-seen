# Pet Seen beta safety, privacy, retention and moderation policy

**Applies to:** the controlled UK beta for dogs and cats.  
**Owner:** Pet Seen product team.  
**Review point:** before public beta promotion, then at least every six months and after any material safety incident.

This is the operating policy for the beta. It informs product and moderation decisions; the public privacy notice, terms and support routes must reflect it before the beta accepts real users.

## 1. Safety policy

### Purpose and boundaries

Pet Seen helps owners share a missing-pet case and lets neighbours submit possible sightings. It is not an emergency, veterinary, animal-control, law-enforcement or dispute-resolution service. The service must not encourage a user to enter private property, confront a person, or put themselves at risk.

The beta is limited to dogs and cats in the United Kingdom and begins in one defined local launch area. A case needs a signed-in owner; a sighting may be submitted without an account.

### Location safety

- Public case pages show only an approximate last-seen area. They never show a street address, house number, precise map pin, or the owner's contact details.
- Exact last-seen and sighting locations are visible only to the case owner and authorised administrators. They are not sent to other members of the public or exposed in public URLs, previews, analytics, or search indexing.
- Free-text fields must not be used to reveal a precise address, gate code, routine, phone number, email address, or another person's identifying information. The product will guide users to use a nearby landmark or broad area instead.
- A sighting reporter may choose a safe public hand-off point rather than their home address. The owner must not be given a reporter's identity or contact information unless the reporter has deliberately supplied it through an approved future contact feature.

### Safe conduct

- Users must contact emergency services if there is immediate danger to a person or animal, and the relevant local authority, vet, rescue or police service where that is the appropriate route.
- Users must not trespass, pursue, trap, transport, accuse, threaten, or publish allegations about another person through Pet Seen.
- Owners remain responsible for confirming a pet's identity and arranging any recovery safely. A sighting is a lead, not evidence that a pet has been found.
- The service will not publish reward offers in the beta. Extortion, payment requests, or claims to hold an animal are escalated immediately and may result in removal, account restriction, and a referral to law enforcement where appropriate.

## 2. Privacy policy

### Data minimisation and access

Collect only information needed to run the missing-case and sighting loop: account email and authentication records, pet and case details, uploaded photos, approximate and exact locations, sighting details, and limited technical/security logs.

| Data                                                          | Who can access it                                        | Public treatment                                                                   |
| ------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Pet name, species, photo, descriptive details and case status | Public when the owner publishes the case; administrators | Removed from public view when the case is closed, reunited, removed or expires     |
| Exact last-seen location and exact sighting location          | Case owner for their case; authorised administrators     | Never public                                                                       |
| Approximate location                                          | Public for an active published case; administrators      | Broad area only; no reversible precision in map, URL or metadata                   |
| Owner email and account data                                  | The owner; authorised administrators where needed        | Never public                                                                       |
| Reporter identity or contact details                          | Authorised administrators; the reporter where applicable | Not collected by default for anonymous sightings and never shown to owners in beta |
| Reports, moderation notes and audit records                   | Authorised administrators                                | Never public                                                                       |

### Product controls

- Uploaded photos are processed to remove EXIF and other embedded location metadata before any public display derivative is created.
- Public case URLs use non-sequential, unguessable identifiers. Access controls must be enforced server-side; hiding a field in the interface is not sufficient.
- Location precision is reduced before public display. Exact geometry must not be included in client responses for a public view.
- Production access is role-based and limited to people who need it for support, moderation, security or legal compliance. Administrator access is logged and reviewed.
- Data is encrypted in transit. Service providers and hosting are selected and configured to support UK data-protection obligations.
- Product analytics must use aggregated or pseudonymous events where possible. They must not record exact locations, raw free text, photo content, or public URL secrets.

### User rights and requests

Before real-user beta launch, publish a privacy notice identifying the data controller, contact route, legal bases, processors, international transfers (if any), and the right to complain to the ICO. Users can request access, correction, deletion, restriction, objection or portability through the support route. Verify the requester before acting, respond within applicable legal time limits, and retain only the minimum evidence needed to record the request outcome.

## 3. Retention and deletion policy

The default retention period is one year. Retention starts from the latest relevant activity or closure event unless the table says otherwise. Data is deleted or irreversibly anonymised at the end of its period, including from live systems and according to the backup expiry schedule.

| Data type                                                   | Retention                                                           | Disposal rule                                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Draft cases not published                                   | 30 days after last activity                                         | Delete draft, photos and precise location data                                               |
| Active published cases                                      | Until closed, reunited, removed, or one year after last activity    | Remove from public view immediately at closure; begin closed-case retention                  |
| Closed, reunited, expired or removed cases and their photos | 90 days after closure/removal                                       | Delete photos, case content and locations; retain only anonymised service metrics            |
| Anonymous sightings, including exact location               | 90 days after submission or linked-case closure, whichever is later | Delete sighting content and location unless a legal hold applies                             |
| Account and profile data                                    | One year after account closure or last activity                     | Delete or anonymise, except minimum records required for legal claims or abuse prevention    |
| Moderation reports, decisions and access audit trail        | One year after final decision                                       | Delete identifying content where no longer necessary; retain aggregated operational counts   |
| Security logs and rate-limit records                        | 90 days                                                             | Delete or aggregate                                                                          |
| Backups                                                     | Maximum 35 days                                                     | Expire automatically; deleted data is not restored except for a documented recovery incident |

Legal obligations, fraud prevention, active investigations, and valid legal claims may require a documented, time-limited hold. A hold is authorised by the policy owner, reviewed every 90 days, and released as soon as the reason ends.

## 4. Moderation policy

### What may be reported or removed

Every public case and sighting flow must provide a clear report route. Moderators may hide, remove, restrict, or preserve content and accounts that involve:

- an exact address or another person's personal data;
- threats, harassment, hate, sexual content, graphic cruelty, self-harm content, or encouragement of unsafe recovery actions;
- scams, payment demands, reward fraud, impersonation, misinformation, spam, or manipulated/non-consensual images;
- allegations of theft or criminal conduct, doxxing, or content that could create a safety risk;
- content unrelated to a genuine dog or cat missing-pet case or sighting.

### Triage and decisions

| Priority | Examples                                                                                                                | Initial action and target                                                                                                                                         |
| -------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical | Immediate risk, credible threat, suspected crime, child-safety concern, animal cruelty, extortion, exposed home address | Hide from public view immediately, preserve evidence, escalate to the on-call safety owner; consider emergency services or police where there is an imminent risk |
| High     | Doxxing, harassment, scam/payment request, false or harmful case                                                        | Restrict or hide within 4 hours during staffed beta coverage; investigate and record the decision                                                                 |
| Standard | Spam, duplicate, inaccurate, off-topic or low-risk policy breach                                                        | Review within 2 business days; correct, remove or leave with a recorded reason                                                                                    |

Moderators do not investigate disputes or verify ownership claims beyond what is necessary to enforce the policy. They do not disclose a reporter's identity, exact locations, private moderation notes, or another user's account information. Two authorised team members review permanent account restrictions where practical; urgent protective actions do not wait for a second review.

### Records, appeals and incident review

Record the report source, time, content identifier, action, policy reason, decision-maker and any escalation. Do not copy more sensitive content into notes than needed. Affected account holders can request a review through the support route unless doing so would create a safety, fraud or legal risk. The policy owner reviews critical incidents and recurring patterns, and updates product controls before expanding the beta.

## 5. Beta readiness checklist

Before admitting real users, confirm that the product has:

- server-enforced access controls for exact locations and private records;
- approximate-location rendering tested on public pages, link previews and API responses;
- EXIF stripping and safe image derivatives tested on uploaded photos;
- report, hide/remove, access-audit and moderation-decision workflows;
- deletion jobs implementing the schedule above, plus backup-expiry evidence;
- a monitored support and emergency escalation route, named policy owner, and staffed moderation coverage; and
- public privacy notice and terms reviewed for the actual hosting, processors and support contact details.
