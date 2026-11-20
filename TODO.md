# TODO — Sʀꜱɪɴ ᴡᴇʙ

## Home library and discovery
- [x] **Home Page:** Include a search bar, genre filter tabs for Fantasy, Action, Romance, and Sci-Fi, and a grid of novel cards showing cover image, title, author, and latest chapter. Search should find novels by title or author; genre filtering should show matching stories.

## Novel details and chapter selection
- [x] **Novel Details Page:** Display the cover, title, synopsis, a “Start Reading” button, and a clickable list of chapters.

## Long-form reader
- [x] **Reader View:** Provide clean typography optimized for long reading, especially Myanmar Unicode font support; Dark, Light, and Sepia background themes; a font-size adjuster with Small, Medium, and Large options; and Next/Previous chapter buttons. Remember reading progress locally so readers can resume.

## Protected admin publishing dashboard
- [x] **Admin Dashboard:** Provide a password-protected route at `/admin` where an administrator can add new novels, upload cover URLs, and publish new chapters using a text editor. Enforce the password on the server and protect all publishing writes.

## Novel and chapter persistence
- [x] **Database:** Store novels and chapters in the managed database and reading progress/preferences on the device.

## Responsive and installable experience
- [x] **Mobile/PWA readiness:** Provide a responsive mobile application manifest and offline-capable app shell that does not cache protected admin/API responses.

## Remove author-facing Studio feature
- [x] **Remove Studio Page:** Completely remove the separate “Studio” page/feature used by authors/translators to upload chapters. Manage and upload chapters directly through the Database or the Admin Dashboard; do not expose a public author-upload surface. The library and reader now use only database/Admin-published content; the prior static demo chapter fallback was removed.

## Admin-controlled user accounts and login
- [x] **No public registration:** Disable public user registration; provide no public Sign-up/Register page, route, or link.
- [x] **Admin-created accounts:** Only the Admin can create reader accounts, through the Database or Admin Panel, by setting a specific Email and Password.
- [x] **Strict login:** Require the exact Email and Password created by the Admin; deny access when either credential is incorrect.
- [x] **Login page:** Provide a clean Login page/section for users to sign in; do not offer public account creation.

## Coin balance and administration
- [x] **Live coin balance:** After login, display the user’s current coin balance in the Header or Profile Menu (for example, “Coins: 45”). Keep the displayed balance automatically current when a paid chapter is unlocked or an admin tops up coins, without requiring a manual page refresh.
- [x] **Admin top-up:** Let the Admin manually add/manage coins for a specific user from the Admin Panel or Database.

## Free/paid chapter access and unlocking
- [x] **Chapter pricing:** Add a Free/Paid setting to every database chapter so the Admin can toggle whether it requires coins.
- [x] **Paid unlock confirmation and charge:** When a user selects a Paid chapter, show the confirmation popup text exactly “Coin 15 ခု ဖြတ်တောက်မည် ဖတ်ရှုမည်လား” with [Yes] and [Cancel]. [Yes] deducts exactly 15 coins and unlocks the chapter.
- [x] **Persistent unlock:** Once a user unlocks a chapter, allow them to reread it later without being charged again.
- [x] **Insufficient balance:** Before unlocking, check the user’s balance. If coins are insufficient or 0, block access and show this exact alert: “Coin လက်ကျန် မလုံလောက်ပါ။ Coin ထပ်မံဖြည့်ရန် telegram Acc - @Sirsinwebnix သို့သွားပါ”.

## Global Light/Dark Mode and colors
- [x] **Fully functional Light/Dark toggle:** Add a persistent, accessible toggle that switches the website-wide theme.
- [x] **Light Mode Palette:** Use Paper White (`#FFFFFF`) for backgrounds, Ink Black (`#050505`) for main text and important areas, and Cornflower Blue (`#548CFF`) for buttons, links, and highlights.
- [x] **Dark Mode Palette:** Use Deep Ink Black (`#050505`) for backgrounds, Soft Paper White (`#F0F0F0` or `#FFFFFF`) for text, and Cornflower Blue (`#548CFF`) for buttons, links, and highlights.

## Website name and branding
- [x] **Website Name Change:** Update the website name across all pages, Header, Browser Title Bar, Footer, and main Logo areas.
- [x] **New Website Name:** Use exactly `Sʀꜱɪɴ ᴡᴇʙ` in the site's branding.

## Novel cover images
- [x] **Admin create/edit cover entry:** In the Admin Panel, when creating or editing a novel, allow the Admin to add a cover image either by uploading an image file from their device or by pasting a cover image URL; show a preview and retain the selected image/source with the novel.
- [x] **Automatic image optimization and storage:** Automatically resize uploaded cover images while preserving their aspect ratio (maximum edge 1800 pixels), compress them as WebP at about 82% quality with JPEG fallback, and keep the compressed file at or below 2 MiB so images load fast and avoid wasting storage or bandwidth. Store uploaded bytes in durable project storage and keep the stable image path with the novel record.
- [x] **Library and details presentation:** Display the cover image cleanly on home/novel listing cards and the novel detail page, with responsive cover cropping, an accessible fallback for missing/broken images, and compatibility with both Light Mode (`#FFFFFF` background, `#050505` text, `#548CFF` accent) and Dark Mode (`#050505` background, `#F0F0F0`/`#FFFFFF` text, `#548CFF` accent).


## Novel card cover rendering correction
- [x] **Cover source and rendering:** Check how cover images are saved and rendered on novel cards (Home / Browse / Story list). Ensure that when a novel has a cover image (uploaded file or cover URL), the actual cover image is properly rendered instead of the default “S” placeholder.
- [x] **Conditional fallback:** Only show the default “S” placeholder when no cover image exists or if the image fails to load.
- [x] **Responsive themed cards:** Keep the card layout clean and responsive on mobile, compatible with both Light Mode (`#FFFFFF` background, `#050505` text, `#548CFF` accent) and Dark Mode (`#050505` background, `#F0F0F0`/`#FFFFFF` text, `#548CFF` accent). In Admin, clearly flag a cover URL that fails to load as an image.
