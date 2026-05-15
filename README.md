# HP-Studier — Studiewebbplats för Högskoleprovet

Mål: Läkarprogrammet vid Karolinska Institutet (HP ≥ 2.0)

## Kom igång

### 1. Förutsättningar
- Node.js 22 eller 24 (node:sqlite inbyggt)
- Internetuppkoppling för scraping

### 2. Installera beroenden
```bash
cd hogskoleprovet
npm install
```

### 3. Konfigurera miljö
Redigera `.env` och lägg till din Anthropic API-nyckel:
```
ANTHROPIC_API_KEY=sk-ant-...
```
Hämta nyckeln från https://console.anthropic.com/

### 4. Kör scraping (hämtar alla prov VT2013–VT2026)
```bash
npm run scrape
```
Tar ~30–60 minuter beroende på anslutning. PDF:er sparas i `.tmp/pdfs/`.
Sammanfattning skrivs ut när klart: antal prov, frågor per sektion, totalt.

### 5. Starta appen
```bash
npm run dev
```
Öppna http://localhost:5173

---

## Funktioner

| Sida | Funktion |
|------|---------|
| Dashboard | Statistiköversikt, HP-poäng mot KI-mål, progress per sektion |
| Övningsläge | Välj sektioner/antal, direkt feedback + AI-förklaring |
| Provsimulering | Fullständigt prov under 55 min/delprov, ingen feedback |
| Frågobibliotek | Sökbar lista med filter på sektion, termin, besvarad/sparad |
| Statistik | Linjediagram, aktivitetsheatmap, svaga områden, AI-studieplan |
| Flashcards | ORD-frågor med spaced repetition + AI-ordboksförklaring |

## Sektioner
- **ORD** — Ordförståelse (verbal)
- **LÄS** — Läsförståelse (verbal)
- **MEK** — Meningskomplettering (verbal)
- **XYZ** — Algebra & geometri (kvantitativ)
- **KVA** — Kvantitativ jämförelse (kvantitativ)
- **NOG** — Tillräcklighet (kvantitativ)
- **DTK** — Diagram & tabeller (kvantitativ)

## Teknisk stack
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Express + node:sqlite (inbyggt i Node 22+)
- **Scraper:** node-fetch + pdfjs-dist + Claude Vision API (fallback)
- **AI:** @anthropic-ai/sdk med prompt caching

## Projektstruktur
```
hogskoleprovet/
├── scraper/src/       # Scraping-pipeline
├── server/src/        # Express API + SQLite
├── client/src/        # React frontend
│   ├── pages/         # Alla 6 sidor
│   ├── components/    # Återanvändbara komponenter
│   ├── hooks/         # useStats, useQuestions, useTimer
│   └── lib/           # API-klient, typer, färger
└── database/          # schema.sql + hp.db (skapas vid scraping)
```

## Noteringar
- VT2021 är inställt (COVID) och hoppas automatiskt över
- DTK-frågor med diagram visar sidnummer för PDF-referens
- Prov utan facit markeras med "Inget facit" i gränssnittet
- Claude Vision API används som fallback om PDF-textextraktion ger för få frågor
