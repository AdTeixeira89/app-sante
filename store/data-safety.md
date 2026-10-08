# Google Play — Data safety form answers

Use these answers in Play Console → App content → Data safety. They describe the app as it is today.

**Does the app collect or share any of the required user data types?** Yes (collects). Sharing with third parties: **No** (Google Firebase acts as a service provider processing data on our behalf; that is not "sharing" under Play's definition).

**Is all of the user data collected by your app encrypted in transit?** Yes (HTTPS/TLS).

**Do you provide a way for users to request that their data is deleted?** Yes.
- In-app: Settings → Delete my account.
- Web link: https://adteixeira89.github.io/app-sante/delete-account.html

## Data types collected

| Category | Type | Collected | Shared | Optional | Purpose |
|---|---|---|---|---|---|
| Personal info | Email address | Yes | No | Required for caregiver accounts | App functionality, Account management |
| Personal info | Name (patient first name, contact names) | Yes | No | Optional | App functionality |
| Personal info | Phone number (emergency contacts typed in by the user) | Yes | No | Optional | App functionality |
| Health and fitness | Health info (medicines, intake records, appointments, sex/age/weight) | Yes | No | Optional | App functionality |
| Photos and videos | Photos (box of medicine, documents) | Yes | No | Optional | App functionality |
| Files and docs | Files and docs (PDF documents, test results) | Yes | No | Optional | App functionality |
| Device or other IDs | Anonymous account ID and device ID | Yes | No | Required | App functionality, Account management |

**Not collected:** location, contacts list, calendar, messages, financial info, web browsing, audio, app interactions/analytics, crash logs, advertising ID.

## Other declarations

- **Ads:** No ads.
- **Target audience:** 18 and over (do **not** select children). The app is not designed for children.
- **Health apps declaration:** The app lets users track medication and appointments. It is **not** a medical device, does not diagnose or treat, and shows a disclaimer. Select "Medication & treatment management" or the closest option and state that no clinical advice is given.
- **Content rating (IARC questionnaire):** answer "No" to violence, sexual content, language, controlled substances (medicine names are user-entered reminders, not promotion), gambling, user-generated content shared with the public. Expected rating: Everyone / PEGI 3.
- **Permissions to justify (Play Console → App content → Sensitive permissions):**
  - `POST_NOTIFICATIONS` — medication and appointment reminders.
  - `SCHEDULE_EXACT_ALARM` — reminders at the exact minute a medicine must be taken. If Play refuses it, the app still works with approximate alarms (a few minutes late).
  - `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK` — restore reminders after a restart (part of the notification library).
- **Government / financial / news apps:** No.
