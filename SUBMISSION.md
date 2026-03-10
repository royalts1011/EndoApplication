# Blog Header Generator — Workflow-Beschreibung

## Was ich gebaut habe

Eine vollständige Web-App, die aus einer Liste von Blog-Titeln automatisch passende Header-Bilder (1200×630 px) generiert — konsistent im Stil, abgestimmt auf die Brand Identity von endometriose.app, und live gehostet unter:

**→ [endoapplication-11c45.web.app](https://endoapplication-11c45.web.app)**

---

## Das zentrale Problem: Konsistenz über 10 Bilder

Wenn man 10 Bilder einzeln generiert, entstehen 10 zufällige Outputs — unterschiedliche Stile, Farbpaletten, Stimmungen. Das ist das Gegenteil von einer kohärenten Bild-Serie.

Meine Lösung: **alle Artikel werden in einem einzigen Gemini-Aufruf verarbeitet**, bevor auch nur ein Bild generiert wird.

---

## Wie der Workflow funktioniert

### Schritt 1 — Artikel holen
Die App scrapt automatisch die aktuellen Blog-Artikel von `endometriose.app` — Titel, URL und Seiteninhalt werden direkt aus dem HTML der Website gelesen.

### Schritt 2 — Gemini versteht die Inhalte (ein einziger API-Aufruf)
Alle Artikel werden **gemeinsam** an Gemini 2.5 Flash geschickt. In einem einzigen Call:
- liest Gemini jeden Artikel-Inhalt
- schreibt eine kurze inhaltliche Zusammenfassung pro Artikel
- generiert einen Bildprompt, der die konkrete Situation des Artikels zeigt
- **definiert ein `seriesConcept`** — eine gemeinsame visuelle DNA (Farbpalette + Illustrationsstil), die für alle Bilder gilt

Das `seriesConcept` ist der Schlüssel zur Konsistenz. Weil Gemini alle Artikel gleichzeitig sieht, wählt es einen Stil, der zur Brand passt *und* für alle Themen der Serie funktioniert.

### Schritt 3 — Bilder generieren
Die Gemini-Bildmodelle erhalten pro Bild:
- den generierten Prompt (style-konsistent aus Schritt 2)
- den Originaltitel und den vollen Artikelinhalt als zusätzlichen Kontext

So entsteht nicht nur visuell eine Serie — jedes Bild ist auch inhaltlich auf seinen Artikel abgestimmt.

### Schritt 4 — Speichern
Bilder werden in Firebase Storage hochgeladen, Job-Metadaten in Firestore gespeichert — für alle Nutzer der App abrufbar über die History-Seite.

---

## Was die App kann

- **Fetch-Button** — lädt automatisch die aktuellen Artikel von endometriose.app
- **Modell-Auswahl** — Gemini 3.1 Flash Image (Standard) oder Gemini 3 Pro (höchste Qualität)
- **Visual DNA** — zeigt das generierte `seriesConcept` als Erklärung für den gewählten Stil
- **Artikel-Zusammenfassung** pro Bild — man sieht, was Gemini im Artikel verstanden hat
- **Einzelbild regenerieren** — unter Beibehaltung der visuellen DNA der restlichen Serie
- **Download** — einzeln als PNG oder alle als ZIP
- **History** — alle generierten Jobs, für alle Nutzer sichtbar (Firestore-backed)
- **Brand Style Guide** — editierbar in der Settings-Seite, wird bei jeder Generierung an Gemini übergeben

---

## Tech Stack

| | |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| KI Textgenerierung | Google Gemini 2.5 Flash |
| KI Bildgenerierung | Gemini 3.1 Flash Image / Gemini 3 Pro |
| Datenbank | Firebase Firestore |
| Bildspeicher | Firebase Storage |
| Hosting | Firebase App Hosting (auto-deploy via GitHub) |
| UI | shadcn/ui + Tailwind CSS v4 |

---

## Code

**GitHub:** [github.com/royalts1011/EndoApplication](https://github.com/royalts1011/EndoApplication)
