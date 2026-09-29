# Statische website — Vrijgezellen Tim

Deze map bevat een eenvoudige statische website zonder framework, buildstap of database.

## Lokaal bekijken

De snelste manier is `docs/index.html` rechtstreeks in een browser te openen.

Op deze pc is Node.js beschikbaar. Start vanuit de hoofdmap van het project een lokale webserver met:

```bash
npx --yes serve docs
```

Open daarna het lokale adres dat in de terminal verschijnt (normaal `http://localhost:3000`).

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
│   └── styles.css                 # Gedeelde vormgeving
└── bestemmingen/
     ├── barcelona.html             # Detailpagina Barcelona
     ├── keulen.html                # Detailpagina Keulen
     ├── lissabon.html              # Detailpagina Lissabon
     └── willingen.html             # Detailpagina Willingen
```

## Een bestemming toevoegen

1. Kopieer een bestaande pagina in `docs/bestemmingen/`.
2. Pas titel, inhoud, metadata en actieve navigatietab aan.
3. Voeg de bestemming toe aan de navigatie van `index.html` en alle bestemmingspagina's.
4. Voeg op `docs/index.html` een bestemmingskaart toe.

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
- De visuele richting is geïnspireerd door het Ayaka-thema: een zwarte basis, subtiele glas-effecten, monospaced typografie en heldere kleuraccenten.
