# Handover — IndiaMart Scraper Project

> Is file ko har session ke start mein padho. Yahan project ka current status, decisions, aur "next kya karna hai" likha rehta hai — taaki pura project baar-baar analyze na karna pade.

## Working style (important)

Ye ek learning project hai. Claude ko khud se sab kuch implement NAHI karna — har important decision (architecture, library choice, schema design, UI, etc.) user se ek-ek karke poochna hai (AskUserQuestion ya plain text se), taaki user apni skills grow kar sake. Sirf mechanical/boilerplate setup (jo decision nahi hai) khud se karna theek hai — jaise scaffolding commands chalana, config files likhna jo already decide ho chuka hai.

## Tech stack (decided)

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL (via Docker), accessed through **Prisma ORM**
- **Scraping:** Playwright (headless browser — IndiaMart JS-heavy hai)
- **Package manager:** npm
- **Structure:** Monorepo — single git repo, `frontend/` aur `backend/` subfolders

## Project location

`C:\Users\abc\Desktop\indiamart-scraper\`

Note: Desktop pe ek **purana, alag** IndiaMart scraper project bhi hai (`C:\Users\abc\Desktop\scrapper\` — NestJS + Next.js, 100+ commits, already mature). User ne explicitly is naye project ko **scratch se, alag** banane ka decide kiya (2026-09-14) — purane wale ko touch nahi karna.

## Ports (important — is machine pe bahut saare dev servers already chalte hain)

Default ports (3000, 4000, 5000) already doosre projects ne le rakhe the, isliye:
- **Backend:** `http://localhost:3001`
- **Frontend:** `http://localhost:3002`

Agar future mein "address already in use" error aaye, pehle `netstat -ano | grep ":<port> "` se check karo ki port free hai ya nahi.

## Current status (as of 2026-09-14)

Done:
- [x] Git repo initialized at project root (no commits yet — user ko pehle decide karna hai kab commit karna hai)
- [x] `docker-compose.yml` — Postgres 16 service (user: `scraper`, db: `indiamart_scraper`, password in file — dev only)
- [x] `backend/` — Express + TypeScript skeleton, `/health` route working, Prisma installed (pinned to stable `7.10.0` — latest `prisma` npm tag was a risky `8.0.0-rc` prerelease pulling in Cloudflare Workers tooling, avoided that)
- [x] `backend/prisma/schema.prisma` — exists but **no models yet**
- [x] `frontend/` — Next.js (App Router, TS, Tailwind) scaffolded via `create-next-app`, default starter page
- [x] Both dev servers verified working (`npm run dev` in each folder) then stopped (not left running)
- [x] Prisma's auto-generated `.claude/skills`, `.agents/skills`, `.windsurf/skills` reference-doc folders removed from `backend/` (just docs bloat, not needed)

Not done yet:
- [ ] Docker Desktop daemon wasn't running when we tried `docker compose up` — needs to be started manually by user, then Postgres container needs to actually be started and verified
- [ ] Database schema (Prisma models) — **not designed yet**, this is the next real decision
- [ ] No scraping logic written yet
- [ ] No API routes beyond `/health`
- [ ] No frontend UI beyond the Next.js default starter page
- [ ] No `.gitignore`-respecting initial commit made yet

## Next step (pick this up first in the next session)

Ask the user: **IndiaMart se exactly kya data scrape karna hai?**
- Category/keyword search se seller listings? (company name, product, price, location, contact, rating, etc. — decide exact fields)
- Ye decide hone ke baad Prisma schema (`backend/prisma/schema.prisma`) design karna hai, phir `npx prisma migrate dev` chalana hai (Postgres container running hona chahiye).
- Uske baad hi actual Playwright scraper likhna start karna hai.

Phir jab bhi koi major decision/phase complete ho, is file ko update karte rehna (status list + "next step" section).
