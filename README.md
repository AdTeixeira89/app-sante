# Kinly

Appointments, medication and documents — together as a family.

Kinly helps a person who needs support (for example an older parent) and the relatives who care for them to stay organised: upcoming appointments, the medicines to take and when, and the documents that go with them, all in one place and shared in real time.

Available as a web app (installable PWA) and as an Android app (Capacitor).

## Features

- **Simple patient screen:** large buttons, adjustable text size, next appointment at a glance, red emergency button that calls a relative.
- **Caregiver area** (protected by a 4-digit PIN): add and edit appointments, medicines (with intake times and a photo of the box), documents and exams; patient profile; emergency contacts; 7-day intake history.
- **Medicine tracking:** each reminder can be marked *skipped*, *taken on time* or *taken now*; late doses are highlighted.
- **Reminders:** on Android, real system alarms (work with the app closed); in the browser, reminders while the app is open.
- **Family sync:** accounts for caregivers, an invitation code for new devices, and every new device must be approved by an existing member.
- **Languages:** English, Français, Español, Português (auto-detected, selectable in the app). Easy to add more in `i18n.js`.
- **Account deletion** from Settings (deletes the family's data if you are the last member).

## Project layout

```
index.html   screens and forms
style.css    design
app.js       application logic (data, navigation, reminders, accounts)
i18n.js      translations (Portuguese is the source text)
native.js    bridge to Android system alarms (Capacitor)
sw.js        service worker (offline + notifications on the web)
manifest.json, icon-*.png   installable web app
android/     Android project (Capacitor)
firestore.rules.txt   Firestore security rules (publish them in the Firebase console)
scripts/build-web.mjs copies the web files into www/ for Capacitor
```

## Firebase setup

1. Create a Firebase project, add a web app and paste its config into `app.js`.
2. **Authentication → Sign-in method:** enable **Email/Password** and **Anonymous**.
3. **Firestore Database:** create the database, then publish the rules from `firestore.rules.txt` (Rules tab).

## Run the web app

Serve the folder with any static server (for example `python3 -m http.server`) and open `index.html`.
The repository is also published with GitHub Pages: `Settings → Pages → main / (root)`.

## Android

The Android build runs in the cloud (GitHub Actions) on every push:

- **Actions → Android build →** latest run → **Artifacts → `kinly-debug-apk`** (a test APK).
- For Google Play, add these repository secrets (Settings → Secrets and variables → Actions) and the workflow also produces a signed `.aab`:
  `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

Locally: `npm install`, then `npm run android:debug` (needs the Android SDK and Java 21).

Keep the signing key safe: without it Google Play will not accept updates.

## Privacy

Data (appointments, medicines, documents, contacts) is stored in the family's Firestore space and is only readable by approved members. Details and how to delete an account: see the privacy policy page (to be published before release).
