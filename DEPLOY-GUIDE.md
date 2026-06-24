# Driftsätta Färdplan på GitHub Pages

## Steg 1 — Lägg till Anthropic API-nyckel i Supabase

1. Gå till https://supabase.com/dashboard/project/ncgxerxkgoxptcwvramn/settings/functions
2. Klicka **Add secret**
3. Name: `ANTHROPIC_API_KEY`
4. Value: din Anthropic API-nyckel (hämta på https://console.anthropic.com)
5. Spara

## Steg 2 — Skapa GitHub-repo

1. Gå till https://github.com/new
2. Döp repot till **fardplan** (viktigt — matchar vite.config.js)
3. Lämna tomt (ingen README), klicka **Create repository**

## Steg 3 — Pusha koden

Öppna Terminal (Mac) eller PowerShell (Windows) och kör:

```bash
cd "C:\Users\mats\Documents\Claude Co-Work OS\Apps & Dashboards\Färdplan Reseapp\fardplan-app"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/DITT-ANVÄNDARNAMN/fardplan.git
git push -u origin main
```

Byt ut `DITT-ANVÄNDARNAMN` mot ditt GitHub-användarnamn.

## Steg 4 — Aktivera GitHub Pages

1. Gå till ditt repo på GitHub → **Settings** → **Pages**
2. Under **Source**, välj **GitHub Actions**
3. Spara

## Steg 5 — Lägg till secrets i GitHub

1. I repot: **Settings** → **Secrets and variables** → **Actions**
2. Klicka **New repository secret** och lägg till:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://ncgxerxkgoxptcwvramn.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (hela nyckeln i .env.local) |

## Steg 6 — Deploy körs automatiskt

GitHub Actions bygger och deplojar appen. Klar om ~2 minuter.

Din app finns på: **https://DITT-ANVÄNDARNAMN.github.io/fardplan/**

---

## Testa lokalt innan deploy

```bash
npm install
npm run dev
```

Appen öppnas på http://localhost:5173/fardplan/
