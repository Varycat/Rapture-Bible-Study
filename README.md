# Bible Study Library v9

## New Settings
Settings now control:
- App title and subtitle
- Primary color, background, text, and card colors
- Font family and font size
- Compact / comfortable / spacious layout
- Rounded / soft / square card style
- Sidebar visibility
- Scripture quote visibility
- Animation preference
- Color presets
- Reset appearance

Appearance settings are stored locally in the browser on each device.

## Study Publishing / Reader Access
The Settings panel also contains Study Access / Publishing.

Only studies with `"published": true` in `data/studies.json` appear to normal readers.

Workflow:
1. Open Settings.
2. Choose which studies should be visible.
3. Click "Download updated studies.json".
4. Replace `data/studies.json` in GitHub.
5. Commit the change.
6. GitHub Pages redeploys and readers see the newly released studies.

IMPORTANT:
This is UI-level publishing on a static GitHub Pages site. It is NOT strong security.
A technically knowledgeable person can inspect public website files.
For true per-person accounts and secure study unlocking, use a backend/authentication service such as Firebase or Supabase.

## Project structure
index.html
manifest.webmanifest
sw.js
css/app.css
js/app.js
data/studies.json
data/topics.json
data/verses.json
icons/icon-180.png
icons/icon-192.png
icons/icon-512.png
