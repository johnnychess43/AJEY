# AJEY certificate payments

AJEY uses Flutterwave Standard Checkout for cards and Kenyan M-Pesa.

## Payment methods

- KES: card and M-Pesa.
- USD: card.
- Flutterwave filters payment methods that are unavailable for a selected currency or merchant account.

## Required Vercel environment variables

Set these in the AJEY Vercel project for Production (and Preview when testing):

- `SUPABASE_SERVICE_ROLE_KEY` — Supabase server-only service role key. Never expose it to browser code.
- `FLW_SECRET_KEY` — Flutterwave secret key.
- `FLW_SECRET_HASH` — webhook secret hash configured in Flutterwave.
- `AJEY_CERTIFICATE_PRICE_KES` — final certificate price in KES.
- `AJEY_CERTIFICATE_PRICE_USD` — final certificate price in USD.

Existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are also required. Never commit real credentials or certificate prices to Git.

## Flutterwave dashboard setup

1. Create and verify the AJEY merchant account.
2. Enable card payments and M-Pesa in Business Preferences → Payment Methods.
3. Add webhook URL: `https://ajey-rosy.vercel.app/api/payments/webhook`.
4. Subscribe to `charge.completed`, configure a strong webhook secret hash, and enable webhook retries.
5. Test with Flutterwave test credentials before switching to live credentials.

## Certificate issuance

Checkout requires an authenticated learner and a 100% row in `learning_progress` for one of the supported course slugs. The server calculates the amount from environment variables; it never trusts a price supplied by the browser.

The webhook verifies the Flutterwave signature, then independently verifies the transaction with Flutterwave. A certificate is issued only when the provider reports a successful transaction and the verified reference, amount, and currency match the stored order. Issuance is idempotent per payment order.

## Endpoints

- `POST /api/payments/checkout` — create a pending order and return the hosted checkout URL.
- `GET /api/payments/callback` — verify the learner's return from hosted checkout.
- `POST /api/payments/webhook` — verify provider-signed notifications.
- `GET /api/certificates` — return the signed-in learner's certificates, progress, and configured prices.

## Go-live checklist

- Configure all server-only secrets and final certificate prices.
- Verify merchant approval, enabled payment methods, webhook URL, and webhook secret hash.
- Ensure real course completion records are written to `learning_progress` only after actual course requirements are met.
- Test successful, failed, cancelled, duplicate-webhook, and mismatched-amount transactions in Flutterwave test mode.
