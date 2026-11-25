# Staff birthdays and completed-plan checks

## Coach and Receptionist birthdays

The two staff profile screens now display and edit `dateOfBirth`. They reuse the
existing date policy (1950 onwards, minimum age 16) and `PUT /api/profile` contract.
Dates are sent at UTC midnight so the calendar day does not shift. A missing
birthday on an existing account is optional; a saved birthday cannot be cleared
through an empty date input.

The deployed BE previously ignored birthdays for users without Member records.
Backend support is prepared in [SportsCenterBE PR #64](https://github.com/phcgnguyen19/SportsCenterBE/pull/64),
including an additive nullable column migration and persistence tests. It must be
merged and deployed before staff birthdays can persist on that environment.

The FE verifies a profile readback before reporting a birthday update as saved.
If an older API ignores the date, the form remains open with a clear error. Other
profile fields may already have been updated; no birthday is stored only in the
browser or invented in the profile cache.

## Completed training plans

Before creating a plan, Coach calls `POST /api/TrainingPlans/check-duplicate`
with the exact validated plan fields. Matching completed plans are shown with
their names, goals and dates. Coach may edit the draft, reopen the AI prompt or
explicitly confirm a repeat. Only that last action sends `confirmRepeat: true`.
Editing the draft invalidates the previous confirmation.

`DUPLICATE_COMPLETED_PLAN` conflicts from the final create call open the same
review, covering a plan completed after the initial duplicate check. Failed or
malformed checks do not fall through to creation. No staff birthdays or training
plans were written to live accounts during validation.
