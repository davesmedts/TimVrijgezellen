# Vrijgezellen Tim — weekend 2027

Planning voor 13 personen, vrijdag 16 tot zondag 18 april 2027. Vertrek uit Antwerpen/Brecht na 17:00 op vrijdag; zondagavond terug.

## Website en bronnen

- `docs/`: de statische website voor GitHub Pages. De groep kiest voor een autoreis; Lissabon blijft zichtbaar als niet-weerhouden referentie.
- `Bestemmingen/`: onderzoeksfiches en voorbeeldplanningen, gegroepeerd in `Auto/` en `Vliegen/` (Londen heeft ook een Eurostar-optie).
- `vrijgezellen.md`: uitgangspunten en deelnemers.
- De La Liga-bestanden in de hoofdmap zijn bewaarde externe onderzoeksbronnen, niet de applicatie. `voetbaltrip_samenvatting.md` is een eerdere voetbalgerichte samenvatting; gebruik de bestemmingsfiches voor de actuele planning.

## Lokaal werken

Node.js 22 of nieuwer. Geen installatie van npm-pakketten nodig.

```bash
npm run dev
npm test
npm run review:browser
```

De website opent op `http://127.0.0.1:3000`. De browsercontrole gebruikt een geïnstalleerde Chrome/Edge en schrijft rapporten en screenshots naar de genegeerde map `.review-artifacts/`. Meer uitleg staat in [`docs/README.md`](docs/README.md).

## Inhoudelijke afspraken

- Budgetplafond: €450 p.p. voor vervoer, slapen en geplande activiteiten, niet voor eten/drinken en nachtleven.
- Geen algemene kostenramingen op de website-overzichtskaarten; berekeningen staan op de detailpagina's.
- Geen reservepost in de kostenberekeningen. Onbekende tarieven, persoonlijke uitgaven en optionele activiteiten expliciet benoemen in plaats van als €0 of geboekte kosten voor te stellen.
- Alle prijzen blijven richtprijzen of begrotingsaannames tenzij een offerte voor de exacte data en de volledige groep is bevestigd.
