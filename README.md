# Prime NOW — landing page

Redesigned landing page for [primenow.ai](https://primenow.ai). Plain HTML, CSS and JavaScript — no build step.

## Run locally

```bash
python3 -m http.server 5173
```

Open http://localhost:5173. To view it from a phone on the same Wi-Fi, bind to all interfaces (`--bind 0.0.0.0`) and open `http://<your-mac-ip>:5173`.

## Structure

| Path | What it holds |
|------|---------------|
| `index.html` | Page markup. Bangla (default) copy lives here. |
| `js/i18n.js` | English copy for every `data-i18n` key, plus runtime strings in both languages. |
| `js/main.js` | Language toggle, smart store links, e-KYC stepper, card picker, Add Money demo, DPS calculator, NOW Buddy chat, spending widget, sticky mobile bar. |
| `css/style.css` | All styles. Brand tokens at the top (`:root`). |
| `assets/` | Logo, card images, store badges, download QR. |

## Editing copy

- Bangla: edit the text in `index.html`.
- English: edit the matching key in `js/i18n.js` (`PN_I18N.en`).
- Text built by JavaScript (chat replies, widget labels): `PN_I18N.ui.bn` / `PN_I18N.ui.en`.

## Notes before going live

- Rates, charges and eligibility are taken from primenow.ai/faq and /product-rates (Jan 2026) — confirm with the product team.
- Names, balances, goals and spending figures are demo data.
- NOW Buddy artwork is a placeholder SVG; replace with the official mascot when available.
- The download QR encodes `https://primenow.ai/?get=app`; `main.js` redirects phones to the right store. It works once this page is deployed at primenow.ai.
