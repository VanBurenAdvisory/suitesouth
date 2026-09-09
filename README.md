# suitesouth

Suite South STR Booking. Fast booking entry for three short-term rental condos. Next.js App Router on Vercel, Neon Postgres, one shared password.

## Setup

1. **Database.** In the Vercel project, go to Storage, install **Neon** from the Marketplace, and connect it. That injects `DATABASE_URL` into the project automatically.

2. **Environment variables.** In Vercel, add these two alongside the injected `DATABASE_URL`:

   | Variable | Value |
   | --- | --- |
   | `APP_PASSWORD` | The shared password you both type to sign in |
   | `SESSION_SECRET` | A long random string. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

   For local work, copy `.env.example` to `.env.local` and fill in all three.

3. **Create the tables.** With `.env.local` pointing at the Neon database:

   ```bash
   npm run db:init
   ```

   This applies `db/schema.sql` and seeds the three properties. It is safe to re-run.

## Commands

```bash
npm run dev         # local dev server
npm run build       # production build
npm run db:init     # apply schema and seed properties
npm run check:calc  # assertions for the booking math
npm run typecheck   # tsc --noEmit
```

## How the money is calculated

The user enters **total revenue for the whole stay**, not a nightly rate. The nightly figure is derived for display only and is never the basis for any other number, so a rounded per-night value cannot skew a payout.

```
subtotal           = stay revenue as entered   (fees sit outside it by default)
nightly rate       = stay revenue / nights     (display only)
manager commission = subtotal x owner_share_pct x commission_pct
owner pool         = subtotal - manager commission
owner due          = owner pool x owner_share_pct
co-owner due       = owner pool - owner due
amount due         = subtotal + fees + tax
```

Commission comes off the top, then **the entire remainder splits by ownership share**.

**Rate terms are not in this repository.** The seed migration inserts placeholder percentages; the real owner share and commission for a deployment are set directly in the database after seeding. Everything below uses the placeholders.

| Property | owner_share_pct | commission_pct | Effective commission |
| --- | --- | --- | --- |
| The Stacy | 100 | 50 | 50% of subtotal |
| The Kerry | 100 | 50 | 50% of subtotal |
| The Cocktail | 80 | 50 | 40% of subtotal |

Worked example, a split-ownership property on $2,000 of stay revenue:

| | |
| --- | --- |
| Manager commission | $800.00 |
| Left to owners | $1,200.00 |
| Majority owner, 80% | $960.00 |
| Co-owner, 20% | $240.00 |

All arithmetic runs in integer cents and rounds once, and the co-owner share is derived by subtraction, so commission plus the owner pool always equals the subtotal exactly, and owner due plus co-owner due always equals the pool exactly.

### Rates are frozen onto each booking

`owner_share_pct`, `commission_pct`, and `fee_treatment` are copied onto the booking row at insert time, and every stored figure is computed from those copies. Nothing recalculates by joining back to `properties`. Changing a property's rate later affects only bookings entered after the change. Historical rows are immutable.

### Fees

Fees are not in use yet and default to zero. The schema carries a `fee_treatment` column on both tables, snapshotted per booking, so a fee can be introduced later without a migration and without disturbing history:

| `fee_treatment` | Effect |
| --- | --- |
| `manager` (default) | Manager retains it to cover a cost, such as card processing or insurance. Owners are unaffected. |
| `owner` | Passed through to the owners, added to the pool before the ownership split. |
| `commissionable` | Folded into the subtotal, so commission is charged on it. |

The guest pays the fee in all three cases. Only the destination differs.

## Auth

One shared password checked server-side against `APP_PASSWORD`, using a constant-time comparison. On success the server sets an httpOnly, SameSite=Lax session cookie holding an HMAC-signed timestamp, valid for 30 days.

Every page and every server action calls `requireAuth()` or `isAuthenticated()` directly rather than relying on a single middleware chokepoint, so there is no one place to bypass.

## Not built yet

Calendar sync, rate comparison, automatic tax calculation, owner statements, and per-user accounts. `tax_amount` is a nullable manual entry field.
