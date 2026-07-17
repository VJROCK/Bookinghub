# BookingHub — Advertisement Booking System

A fully working re-implementation of the **Advertisement Booking (Classified & Display)** system
described in the 4C Plus user manual, built with **React (Vite)** + **Node/Express** + **SQLite**
(Node's built-in `node:sqlite` — no native modules to compile).

## Requirements

- **Node.js 22.13 or newer** (uses the built-in SQLite module) — check with `node --version`

## Quick start

```bash
cd BookingHub
npm run setup     # installs server + client dependencies
npm run dev       # starts API (port 4000) + React dev server (port 5173)
```

Open **http://localhost:5173**

Or production style (uses the pre-built client in `client/dist`, single port):

```bash
cd BookingHub/server && npm install && npm start
# open http://localhost:4000
```

## Login (demo users)

| User | Password | Role |
|------|----------|------|
| admin | admin123 | Administrator |
| booking | booking123 | Booking Executive |
| auditor | audit123 | Auditor |

The database (`server/db/bookinghub.sqlite`) is created and **seeded with demo data**
(publications, editions, rates, agencies, clients, bookings, bills) on first start.
To reset everything: `cd server && npm run seed`.

## Application layout (as per the manual)

- **Masters** — all 78 master forms (sections 4.1 – 4.78), grouped exactly like the manual:
  Agency/Client, Executive/Retainer, Environment, Publication and Rate masters.
  Complex masters (Agency, Client, Retainer, Currency, Package, No-Issue, Contract…) include their
  detail tabs (Commission Details, Pay Mode, Contacts, Bank Guarantee, Status, Conversion Rates, Edition Details…).
  Every master page has the manual's toolbar: New / Save / Modify / Query+Execute / Clear /
  First / Previous / Next / Last / Delete.
- **Transactions** (section 5) — Display Booking and Classified Booking (the 8-part booking forms
  with Ad / Package / Page / Rate / Bill / Box / VTS tabs, F2 agency/client lookup, walk-in client
  registration, matter composing editor, Get Rate from Rate Master or Contract, scheme free
  insertions, premiums, eye catchers, box charges), QBC quick booking, Payment Gateway,
  Confirm/Unconfirm Ads, Booking Audit, Publish Audit, Rate Audit, Proof Reading, Deal Audit,
  Deal Provision, Rate Expiry, Follow Up, Mis Updation, Pending For Dummy, CD Upload.
- **Ad Search** (section 7) — find any booking by matter / agency / client / dates / executive.
- **Billing** (section 8) — bill generation from published + audited insertions, bill register,
  Revised Billing (cancel + regenerate with a new bill number).
- **Reports** (section 6) — 30+ reports in the manual's four groups (Ad Reports, MIS Reports,
  Schedule Register, Billing Reports), every one driven by the transaction tables joined with the
  masters; each has filter parameters, on-screen output, totals and CSV (Excel) export.
- **Application Settings** (section 9) — Create User, Log, Change Password, Master/User/Role
  Permission, Form Name, Generate Ref File (classified text export for pagination), Preferences
  (including the "Rate Audit required" switch) and Copy Rate.

## Booking → Billing workflow

1. **Book** the ad (Display / Classified / QBC). Rate is picked automatically from **Rate Master**
   (or the agency's **Contract**); gross, trade discount and bill amount are computed like the manual
   (agreed rate → discount, page/position premium, eye catcher, box charges, scheme free insertions,
   agency commission, retainer commission). The insertion schedule is generated from Publish Date ×
   No. of Insertions × Repeating Day for every edition in the selected packages (no-issue dates are skipped).
2. **Booking Audit** — auditor passes the booking.
3. **Publish Audit** — insertions are marked Published after pagination.
4. **Rate Audit** — rates checked before billing (optional via Preferences).
5. **Billing** — generate bills (tax %), print register, revise bills when needed.

Modifying a booking archives the old booking id as *Previous Booking ID* and issues a new one,
exactly as the manual describes.

## Project structure

```
BookingHub/
├── package.json          # npm run setup / dev / build / start
├── scripts/dev.js        # runs server + client together
├── server/
│   ├── index.js          # Express API
│   ├── db.js             # SQLite (node:sqlite) + table creation
│   ├── mastersConfig.js  # single config driving all 78 masters (DB + API + UI)
│   ├── bookingEngine.js  # rate pickup, amount computation, insertion generation
│   ├── db/seed.js        # demo data
│   └── routes/           # auth, masters, bookings, billing, reports, settings
└── client/
    ├── dist/             # pre-built UI (served by the server)
    └── src/
        ├── App.jsx       # shell, sidebar navigation (module tree)
        ├── components.jsx
        └── pages/        # one page per form, as requested
```
