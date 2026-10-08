# Release checklist — Kinly on Google Play

## Already done
- [x] Android project (Capacitor), cloud build in GitHub Actions
- [x] Native medication reminders (system alarms)
- [x] In-app account deletion + web page
- [x] Privacy policy page (EN/PT/FR)
- [x] Store texts (see `listing.md`) and Data safety answers (see `data-safety.md`)

## Needs you
1. [ ] Create **kinly.app.support@gmail.com** (2-step verification on).
2. [ ] Create a **Google Play developer account** (https://play.google.com/console, 25 USD one-off). Identity verification can take several days — start now. Use your legal name (Adão Teixeira).
3. [ ] Trademark check on "Kinly" (EUIPO, WIPO, USPTO) — another app with this name exists in the same field.
4. [ ] Approve the design (`ui-refresh` branch) → merge to `main`.
5. [ ] Publish the Firestore rules for account deletion (`firestore.rules.txt`).
6. [ ] Create the **upload key** (see below) and add the 4 GitHub secrets.
7. [ ] Test the APK on a real Android phone (reminders with the app closed, notifications permission, exact alarms).
8. [ ] Take screenshots (2–8 phone screenshots) and the 1024×500 feature graphic.

## Upload key and signed bundle
The workflow `.github/workflows/android.yml` builds a signed `.aab` as soon as these repository secrets exist
(GitHub → Settings → Secrets and variables → Actions):

- `ANDROID_KEYSTORE_BASE64` — the keystore file encoded in base64
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Use **Play App Signing** (default): Google keeps the real app-signing key; you only keep an *upload key*, which can be reset
through Play support if it is ever lost. Never commit the keystore to the repository (it is public).

## Play Console steps
1. Create app → name "Kinly: Family Health Planner", default language English, App, Free.
2. App content: privacy policy URL, ads (none), data safety, target audience (18+), content rating, health apps declaration, account deletion URL.
3. Store listing: texts from `listing.md`, icon, feature graphic, screenshots; add Portuguese and French translations.
4. Testing → Closed testing: upload the signed `.aab`, add at least **12 testers** (email list) and keep the test running **14 days** (required for new personal accounts before production access).
5. Apply for production access, then roll out (start with 20 % of users).

## After release
- Keep the keystore and passwords in a password manager (two copies).
- Bump `versionCode` in `android/app/build.gradle` for every new upload.
