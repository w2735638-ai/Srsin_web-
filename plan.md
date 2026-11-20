# Sʀꜱɪɴ ᴡᴇʙ — Implementation Plan

## Product and implementation

Build a responsive, installable-feeling web novel reader on the initialized React + TypeScript + Vite / Express + tRPC / Drizzle + managed MySQL starter. Keep public reading pages usable without an account. Use the managed database for novel and chapter content; keep reading progress, reader theme and type size on-device in local storage so reading does not require reader accounts or a sync/auth service.

The home page will provide title/author search, the requested Fantasy, Action, Romance and Sci-Fi genre filters, and responsive cover-led novel cards with author and latest chapter. Novel detail routes will show the cover, synopsis, a start/resume-reading action and linked chapters. Reader routes will fetch chapter content and provide previous/next navigation, Small/Medium/Large type size and Light/Dark/Sepia palettes. Its reading measure and spacing will be tuned for long-form text, and the font stack will explicitly prefer Myanmar-compatible Unicode fonts (including Myanmar Text/Noto Sans Myanmar fallbacks) before general sans-serif fallbacks.

The `/admin` route will be protected by a shared server-side `ADMIN_PASSWORD` supplied only through the platform's protected secret-input flow. The server will compare credentials and issue a short-lived signed HttpOnly admin cookie; no default password, credential in source, or client-side-only gate. Failed sign-in attempts are throttled per client address. Public library and chapter operations remain read-only; admin-only tRPC procedures add novels and publish chapters. Novel/chapter rows will have stable IDs, relationships, timestamps and publish status. Reading progress remains in local storage, with a versioned browser key so it can be migrated later if synchronized accounts are added.

Add an application-owned web manifest and a small service worker that caches the app shell and manifest for repeat/offline launch, without caching private admin/API responses or chapter data as a promise of offline availability. Ensure the manifest, icons/fallback treatment, metadata and responsive viewport cooperate with mobile installation. Keep `/manus-routes.json` aligned with `/`, `/novel/:id`, `/read/:novelId/:chapterId`, `/admin`, and `/404`.

## Structure and responsibilities

- `client/src/App.tsx`: route registration and shared app shell.
- `client/src/pages/`: Home, NovelDetails, Reader, Admin and the existing NotFound page.
- `client/src/components/`: reusable header, genre controls, novel cards, chapter list, reader toolbar and admin forms.
- `client/src/lib/`: typed tRPC client, reader preferences/progress storage and formatting helpers.
- `client/src/contexts/ThemeContext.tsx`: persistent, site-wide Light/Dark state shared by the header and reader controls.
- `client/src/index.css`: the selected design system, mobile layouts, reader theme variables and Myanmar-friendly type stack.
- `server/routers.ts`: public novel/chapter queries plus signed-cookie admin login/logout and protected mutations.
- `server/db.ts`: database queries for novels and chapters; keep existing user helpers intact.
- `drizzle/schema.ts`, `drizzle/*.sql`: additive relational schema and migration for novels and chapters; avoid destructive changes to the existing users table.
- `public/`: route manifest, application-owned PWA manifest, service worker and app icon assets.

## Design direction

**Chosen: clean paper-and-ink digital reading minimalism, using the exact new brand and palette requested by the user.**

- **Design Movement:** Contemporary reading-first minimalism: paper-white pages by day, deep black pages by night, with one clear blue accent.
- **Core Principles:** Comfortable sustained reading; high-contrast simple surfaces; a consistent Cornflower Blue action color; compact, accessible mobile controls.
- **Color Philosophy:** Light mode uses Paper White `#FFFFFF` backgrounds and Ink Black `#050505` text. Dark mode uses Deep Ink Black `#050505` backgrounds and Soft Paper White `#F0F0F0` text. Both modes use Cornflower Blue `#548CFF` for buttons, links and highlights.
- **Layout Paradigm:** A left-anchored editorial masthead and asymmetric featured-story area lead into a responsive cover grid; details use a cover-and-copy split on wide screens and a stacked flow on mobile. Reader pages narrow to a centered measure with quiet edge controls.
- **Signature Elements:** An open-book symbol paired with the exact `Sʀꜱɪɴ ᴡᴇʙ` wordmark; slim blue book-spine and chapter-progress details; covers presented like book jackets.
- **Interaction Philosophy:** A visible, keyboard-accessible Light/Dark switch in the shared header, persisted in local storage and reflected in the browser theme-color. Reader Light/Dark controls share the same global preference; Sepia remains an optional reader-only surface.
- **Animation:** Short, low-amplitude fades/slides only for page entry and feedback; no looping motion; honor reduced-motion preferences.
- **Typography System:** A characterful editorial display serif for titles, an unobtrusive UI sans for controls and metadata, and a generous Myanmar-aware body stack (`Myanmar Text`, `Noto Sans Myanmar`, then platform sans-serif). Body line height and character measure prioritize sustained reading.
- **Brand Essence:** `Sʀꜱɪɴ ᴡᴇʙ` is a calm home for serialized fiction and Myanmar-friendly reading; **clear, literary, welcoming**.
- **Brand Voice:** Brief, human, bookish, never pushy. Examples: “Find your next world.” and “Pick up where the story left you.”
- **Wordmark & Logo:** Render the supplied stylized name exactly as `Sʀꜱɪɴ ᴡᴇʙ` beside an open-book glyph in the header, footer, browser title and PWA metadata; update the favicon/app icon and remove the old `I&E` monogram.
- **Signature Brand Color:** Cornflower Blue `#548CFF`, used consistently for buttons, links, focus rings, active states and highlights in both modes.

## Dependencies and serving

Use the starter's existing stack and installed dependencies; add no heavy editor package unless a basic accessible multiline chapter editor proves insufficient. Accept user-provided HTTP(S) cover URLs or optimized local image uploads stored in durable project storage, and use designed local fallback covers when absent or unavailable. Keep backend validation in Zod and authorization on the server for all writes. The app is served by the existing Express/Vite development entry point and uses the already-enabled managed MySQL database. PWA static files are served from the public asset directory; update `client/index.html`, `manifest.webmanifest`, `icon.svg`, and project logo metadata to the new name and blue/black/white theme. Bump the service-worker cache version when frontend assets change, while keeping `/manus-storage/` images out of offline caching.

## Scope and constraints

Required behavior remains: searchable home, four genre tabs, novel card details, novel/chapter detail and reading, site-wide Light/Dark mode plus the reader's Light/Dark/Sepia controls, three sizes, next/previous controls, password-protected `/admin`, novel and chapter publishing, relational novel/chapter persistence, reading progress, responsive mobile layouts and PWA readiness. No public user accounts, publishing action, or production password value will be embedded in the app. A valid admin password must be provided through the protected secret card before the admin dashboard can accept sign-in. The site will be built and saved as a checkpoint; publishing is separate and will not be enabled automatically.


## Account, access, and coin-system update

Use the selected paper-and-ink design from the section above and route the existing private `/admin` capability as an **Admin Dashboard**, not an author-facing Studio. Remove Studio naming/navigation and do not expose public writer chapter-upload access; chapter publishing remains an Admin-only workflow within `/admin` (or database administration). Add `/login` with no public registration route or sign-up link. The Admin Dashboard will create reader accounts by email/password and manually top up account coins.

Keep Manus OAuth's existing `users` table and platform routes intact, but use a separate application-owned `reader_accounts` table for the requested Admin-created reader identities. Store passwords only as salted scrypt hashes; issue opaque random reader-session cookies and store only token hashes with expiry in `reader_sessions`. Add a `coins` balance, an append-only `coin_transactions` ledger, and uniquely keyed `chapter_unlocks` records. Add `chapters.isPaid` with a database default of false so existing chapters remain free. The only public account operation is login/logout/current-account status; account creation and coin adjustments require the existing server-validated Admin session.

Novel detail responses will expose chapter metadata and per-account unlock status, never chapter bodies. A dedicated server query returns paid content only to a signed-in account after a persisted unlock; free content remains readable. Unlocking runs in one database transaction: lock the account, recheck for an existing unlock, reject insufficient balance, deduct exactly 15 coins, add the ledger row and the unique unlock row. The unique unlock ensures a repeat read does not charge again. Reader attempts route logged-out users to `/login`; signed-in readers receive the exact requested Myanmar confirmation and insufficient-balance alert. A balance query refreshes automatically while signed in and is invalidated immediately after an unlock/top-up.

Responsibilities added/changed: `drizzle/schema.ts` and additive migrations hold reader accounts, sessions, unlocks, ledger and chapter pricing; `server/readerAuth.ts` handles password hashing and DB-backed sessions; `server/coinStore.ts` handles account administration, transactional top-ups/unlocks and protected chapter reads; `server/_core/context.ts` attaches an optional reader account; `server/routers.ts` exposes login, account, admin-only management and gated chapter procedures; `client/src/pages/Login.tsx` is the sign-in-only UI; `client/src/pages/Admin.tsx` is the private Admin Dashboard; `NovelDetails.tsx`, `Reader.tsx` and `LibraryChrome.tsx` handle unlocking, access and live balance; `client/public/manus-routes.json` includes `/login`. Existing database records are preserved; migration adds fields/tables only.


The catalog and reader use the managed database as the only source of novel/chapter content. Do not seed or serve embedded sample novels/chapters from frontend code; when the database library is empty, show an empty shelf and direct publishing to the Admin Dashboard.


## Novel cover image upload and editing update

Extend the protected Admin novel editor so the same form creates a novel or edits a selected existing novel. Let the Admin either paste a complete HTTP(S) cover image URL or choose a local JPEG, PNG or WebP file. Before upload, resize the image in the browser while preserving its aspect ratio (maximum edge 1800 pixels), encode as WebP at approximately 82% quality with JPEG fallback, and keep the compressed output at or below 2 MiB. Show a preview before saving.

Upload the compressed image only through a new Admin-protected tRPC mutation. Validate the base64 payload size, declared content type and JPEG/PNG/WebP file signature on the server, then use the template's `storagePut` helper to store it in durable project object storage under a random-suffixed `novel-covers/` key. Persist the stable relative `/manus-storage/...` path in `novels.coverUrl`; do not put image bytes in MySQL, Git or a browser-visible credential. Extend existing cover-source validation to permit only HTTP(S) URLs or this platform-owned storage path. Add a database-backed novel update procedure to reuse the same editor for existing records; no schema migration is needed.

Keep the existing 3:4 `CoverArt` presentation on library/featured cards and novel details, with lazy/async decoding, responsive object-fit cropping and the existing fallback art when no cover is supplied. The cover image itself remains unchanged between Light and Dark modes while the surrounding components retain the exact Paper White/Ink Black/Cornflower Blue palettes. Add focused server-side unit tests for valid image signatures, rejected spoofed/unsupported formats and payload-size limits; rely on the existing TypeScript, test and build commands plus the Webdev storage contract for verification.


## Novel card cover rendering correction

Read-only inspection confirmed that `novels.list` returns the stored `coverUrl` and Home passes it into the shared `CoverArt`; two stored `/manus-storage/novel-covers/*.webp` assets return valid `image/webp` bytes through Cloud Preview. A third existing Shadow slave row instead points to a Webnovel story page (HTML), not a direct image URL, so its fallback is expected. `CoverArt` currently renders `.cover-fallback` unconditionally even when an image source exists. Track image load failure per source and render the letter only when the source is absent or its `<img>` fires an error; a successful load removes the fallback. In the Admin cover preview, make failed/non-image URLs explicit so the Admin can replace them with a direct image URL or a device upload. Do not alter the existing novel records or guess a replacement cover. Preserve the established 3:4 crop, responsive layout, and Light/Dark palettes; verify with the mobile Webdev screenshot and project checks.
