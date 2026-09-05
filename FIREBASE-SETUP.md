# Bible Study Library v11 — Private Progressive Access

This is the finished progressive-access design for a very small private group.

## What it does
- Every person signs in with their own Firebase email/password.
- Readers only see studies you explicitly unlock for them.
- Study content is stored in Firestore, not public GitHub JSON files.
- Readers can mark topics complete.
- Readers can mark a whole study complete.
- As owner, Settings -> Reader Access shows:
  - which studies each reader can access
  - which studies they have completed
- When someone finishes the Rapture study, you edit that reader and unlock the next study.

## One-time Firebase setup

### 1. Create a Firebase project
Create a Firebase project and Web App. Paste the Web App config into:
`js/firebase-config.js`

### 2. Authentication
Firebase Console -> Authentication -> Sign-in method -> Email/Password -> Enable.

Create 3 accounts:
- Your owner account
- Reader 1
- Reader 2

### 3. Firestore
Create Firestore Database in production mode.

Copy all of `firestore.rules` into Firestore -> Rules and Publish.

### 4. Make yourself owner
Sign in once, then copy your UID from Firebase Authentication.

Firestore:
Collection: `owners`
Document ID: YOUR FIREBASE UID
Field: `role` = `owner`

### 5. Upload the Rapture study into Firestore
IMPORTANT: `rapture-firestore-seed.json` is delivered as a separate file.
Do NOT upload it to GitHub.

Sign into your web app as owner.
Settings -> Reader Access -> Owner Study Import.
Select `rapture-firestore-seed.json`.

The app uploads:
studies/rapture
studies/rapture/topics/*
studies/rapture/verses/*

### 6. Give the first study to each reader
Settings -> Reader Access
Enter the reader email.
Check `The Rapture of the Church`.
Save Reader Access.

Repeat for the second reader.

## When a reader finishes
The reader taps:
`Mark Study Complete`

You sign in as owner:
Settings -> Reader Access

You will see:
Completed: rapture

Click Edit for that reader.
Check the next Bible study.
Save Reader Access.

That reader gets the new study the next time the app refreshes/signs in.

## Security
The study content itself is in Firestore and Firestore security rules control access.
The deploy package leaves `data/topics.json` empty and `data/verses.json` empty.

Do NOT upload private seed JSON files to the public GitHub repository.
