# Minesweeper Phone App

This is a Progressive Web App. Once hosted over HTTPS, it can be installed to your phone home screen and played offline.

## Quick Local Test

From the `Playground` folder:

```sh
python3 -m http.server 4173
```

Open:

```text
http://127.0.0.1:4173/minesweeper-phone/
```

On your phone, use your computer's local IP address while both devices are on the same Wi-Fi:

```text
http://YOUR_LOCAL_IP:4173/minesweeper-phone/
```

Local Wi-Fi play is useful for testing, but offline install support generally requires HTTPS.

## Best Install Path

1. Upload the `minesweeper-phone` folder to a static host such as Netlify, Vercel, Cloudflare Pages, or GitHub Pages.
2. Open the HTTPS URL on your phone.
3. On iPhone: tap Share, then Add to Home Screen.
4. On Android Chrome: tap the menu, then Install app or Add to Home screen.
5. Open it once while online so the game files are cached for offline play.

Scores are stored locally on the device. Clearing browser/site data will clear the leaderboard.
