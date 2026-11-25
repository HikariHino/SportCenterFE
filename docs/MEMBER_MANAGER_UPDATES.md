# Member training plans and Manager accounts

## Member

Active plans show the backend's `hasCompletedBefore`, `previousCompletedPlanId`
and `repeatNotice` evidence. Members can submit a 1-1000 character request to
`POST /api/TrainingPlans/{id}/request-change`; requests keep the current plan
unchanged and are routed to its Coach by the backend.

The new "Đã tập" confirmation uses a separate Member-only completion endpoint:
`POST /api/TrainingPlans/{id}/complete`. The frontend resolves the signed-in
Member, reloads their plans, and confirms the returned Completed plan before
moving it into history. It never calls the Coach-only status API. Support is
prepared in [SportsCenterBE PR #65](https://github.com/phcgnguyen19/SportsCenterBE/pull/65).
Deploy it before this action can succeed on an older environment. Missing routes
or failed requests keep the plan unchanged and show an error.

## Manager

The account creation form accepts an optional birthday and applies the existing
1950/minimum-16 policy. Birthdays are sent at UTC midnight and verified against
the saved staff response/detail. If an older backend creates the account but
ignores the date, the frontend reports that partial result and prevents accidental
duplicate creation. Birthdays appear in staff details.

[SportsCenterBE PR #64](https://github.com/phcgnguyen19/SportsCenterBE/pull/64)
now also includes birthday support for staff creation/list/detail, alongside the
nullable Users column and staff profile persistence. Merge, migrate and deploy
that change for birthdays to persist on the current backend.

Manager profile now reads `/api/profile`, supports editing personal information,
password changes with the current password, email OTP verification and font size
settings. Confirmed name changes update the current login display without
starting a new session or storing password fields. Staff birthdays use verified
readback and require the same backend support as Coach and Receptionist.

Validation uses isolated fixtures and mocked frontend API responses; no live
account or training plan was changed while implementing these features.
