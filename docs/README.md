# Statische website — Vrijgezellen Tim

Deze map bevat een eenvoudige statische website zonder framework, buildstap of database.

## Lokaal bekijken

De snelste manier is `docs/index.html` rechtstreeks in een browser te openen.

Met Node.js 22 of nieuwer kun je vanuit de hoofdmap een lokale webserver starten, zonder pakketten te installeren:

```bash
npm run dev
```

Open daarna `http://127.0.0.1:3000`. Een andere poort is mogelijk via de omgevingsvariabele `PORT`.

## Controles

Voer vanuit de hoofdmap uit:

```bash
npm test
npm run review:browser
```

- `npm test` controleert interne links, navigatie, metadata, budgettotalen, Markdown-tabellen, inhoudelijke afspraken, de aftelklok en de themakeuze.
- `npm run review:browser` gebruikt een lokaal geïnstalleerde Chrome/Edge-browser om alle zes pagina's in lichte en donkere modus te controleren op 320, 390, 768, 1024 en 1440 pixels breed. Het controleert overflow, tekstcontrast, toetsenbordfocus, de themaschakelaar en opgeslagen voorkeur, kosten en JavaScript-fouten.
- Screenshots en resultaten staan in `.review-artifacts/`, buiten Git. Externe fonts en kaarten worden bij deze automatische controle geblokkeerd; de fallbacktypografie wordt dus ook getest.
- Als de browser niet automatisch gevonden wordt, stel `BROWSER_PATH` in op het uitvoerbare bestand.
- De browsercontrole is een praktische regressiecheck, geen volledige WCAG- of HTML-validator. Controleer ook handmatig met Tab, op een telefoon en met de echte externe fonts/kaarten.

Als Python op een andere computer wel geïnstalleerd is, kan het ook met:

```bash
python -m http.server 8000 --directory docs
```

## Structuur

```text
docs/
├── index.html                     # Overzicht
├── assets/
│   ├── countdown.js               # Aftelklok op de hoofdpagina
│   ├── theme.js                   # Licht/donker en opgeslagen voorkeur
│   └── styles.css                 # Gedeelde vormgeving
└── bestemmingen/
     ├── amsterdam.html             # Detailpagina Amsterdam
     ├── barcelona.html             # Detailpagina Barcelona
     ├── keulen.html                # Detailpagina Keulen
     ├── lissabon.html              # Detailpagina Lissabon
     └── willingen.html             # Detailpagina Willingen
```

## Lichte en donkere modus

Bovenaan elke pagina staat een zon- of maanicoon. In de donkere modus staat er een zon om de lichte modus in te schakelen; in de lichte modus staat er een maan om terug te schakelen naar donker. Op mobiel staat de knop naast het logo, boven de navigatie.

De site start standaard in donkere modus. Een expliciete keuze wordt in `localStorage` bewaard en vóór het tonen van de pagina hersteld, ook bij navigatie naar een andere bestemming. Als de browser opslag blokkeert, werkt wisselen nog steeds op de huidige pagina. Zonder JavaScript blijft de donkere website bruikbaar en wordt de schakelaar verborgen.

## Een bestemming toevoegen

1. Kopieer een bestaande pagina in `docs/bestemmingen/`.
2. Pas titel, inhoud, metadata en actieve navigatietab aan.
3. Voeg de bestemming toe aan de navigatie van `index.html` en alle bestemmingspagina's.
4. Voeg op `docs/index.html` een bestemmingskaart toe.
5. Voeg op de detailpagina een kostenkaart met `id="kosten"` toe. Zet `data-min`/`data-max` op de rekenposten en `data-total-min`/`data-total-max` op het afgeronde totaal; de tests controleren de optelling.
6. Gebruik een compacte samenvatting voor zonsopkomst en zonsondergang met lokale tijdzone. Vermeld richtprijzen en onbevestigde beschikbaarheid expliciet.
7. Houd homepagekaarten vrij van kostenramingen. Persoonlijke uitgaven/nachtleven en een reservepost horen voorlopig niet in de berekeningen.

Dit kan volledig door een AI-agent worden uitgevoerd op basis van een nieuwe Markdown-fiche.

## Publiceren met GitHub Pages

1. Push de repository naar GitHub.
2. Open **Settings → Pages**.
3. Kies **Deploy from a branch**.
4. Selecteer de gewenste branch en de map **`/docs`**.

De website heeft geen servercode en kan ook via Netlify, Cloudflare Pages of een gewone webserver worden gepubliceerd.

## Bronnen

- De overzichtspagina is gebaseerd op `vrijgezellen.md`.
- De detailpagina's vatten bestemmingsfiches samen uit de map `Bestemmingen/`.
- De Keulen-pagina is gebaseerd op `Bestemmingen/Keulen/keulen.md`.
- De Willingen-pagina is gebaseerd op `Bestemmingen/Sauerland/sauerland.md`.
- De aftelklok loopt tot vrijdag 16 april 2027 om 17:00 Belgische zomertijd.
- De Google Maps-kaarten gebruiken Plaça de Catalunya, Rossio en de Dom van Keulen als indicatieve stadscentrum-markers; exacte verblijfslocaties zijn nog niet bekend.
- De visuele richting is geïnspireerd door het Ayaka-thema: een zwarte of lichtgrijze basis, subtiele glas-effecten, monospaced typografie en kleuraccenten met aangepast contrast per modus.
- La Liga-HTML, JavaScriptbundels en JSON in de repositoryhoofdmap zijn bewaarde externe onderzoeksbronnen; ze zijn geen onderdeel van de gepubliceerde website of eigen applicatiecode.
