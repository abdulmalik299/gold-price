# LuxGold Dashboard (Vanilla • Open index.html)

## What you get
- Live XAU ounce price (USD base) from metals.g.apised.com
- Up/Down deltas with arrows + persistent color (no reset)
- Karats (24/22/21/18) per mithqal (5g) or per gram
- Optional USD→IQD conversion (type a rate; clears back to USD)
- IQD-only margin slider (0 → 70,000 step 1,000) + expectation section with its own slider
- Margin solve tool that auto-sets the main slider
- Connection status (online/offline + strength if supported)
- Advanced chart: zoom/pan, crosshair ruler (+), timeframe buttons
- Web Worker smoothing + noise filter (>= $0.10)
- Samsung-like calculator (÷, ×, %, parentheses, sign toggle, history)

## Important limitation (GitHub history storage)
A static website cannot **write** to GitHub without a server or a GitHub token.
So this project:
- Stores chart history locally (localStorage)
- Lets you export history JSON and commit it to your GitHub repo manually

If you want automatic GitHub storage, you can add a server or GitHub Actions pipeline.
(If you want, ask me later and I’ll provide the Actions workflow + a safe serverless approach.)

## Run
Just open `index.html`.

## API Key Notice
`logic.js` contains the API key you provided. Anyone can view it in page source.
For production, use a backend proxy and keep the key secret.
