# AJEY certificate payments

AJEY uses IntaSend hosted Checkout for certificate payments.

## Payment methods

- KES: M-Pesa and cards, subject to the methods enabled for the merchant account.
- USD: cards, subject to merchant approval and enabled methods.
- The hosted checkout displays the payment methods available for the selected currency and account.

## Required Vercel environment variables

Set these in the AJEY Vercel project for Production, Preview and Development:

- `SUPABASE_SERVICE_ROLE_KEY` — Supabase server-only service role key. Never expose it to browser code.
- `INTASEND_PUBLISHABLE_KEY` — IntaSend publishable key used to create hosted checkout sessions.
- `INTASEND_SECRET_KEY` — IntaSend secret key used only by server-side payment verification.
- `INTASEND_WEBHOOK_CHALLENGE` — the exact challenge string configured for the IntaSend webhook.
- `AJEY_CERTIFICATE_PRICE_KES` — certificate price in KES (500).
- `AJEY_CERTIFICATE_PRICE_USD` — certificate price in USD (5).

Existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are also required. Never commit real credentials or certificate prices to Git.

## IntaSend dashboard setup

1. Use sandbox keys for testing first. IntaSend uses the same API base URL for sandbox and live; the key prefix selects the environment.
2. Add webhook URL: `https://ajey-rosy.vercel.app/api/payments/webhook`.
3. Subscribe to `collection_event`.
4. Set a strong webhook Challenge and save the identical value as `INTASEND_WEBHOOK_CHALLENGE` in Vercel.
5. Confirm that your merchant account has KES M-Pesa and card methods enabled. Confirm USD card availability before advertising USD checkout.

## Verification and certificate issuance

Checkout creates a pending payment order with a unique AJEY reference. AJEY stores the IntaSend invoice ID and hosted checkout URL. A redirect alone never proves payment: both callback and webhook independently query IntaSend's invoice-status endpoint using the server-side secret key. A certificate is issued only when the provider reports `COMPLETE` and the invoice ID, AJEY reference, amount and currency match the stored order. Issuance is idempotent.

Checkout requires an authenticated learner and a 100% row in `learning_progress` for one of the supported course slugs.

## Endpoints

- `POST /api/payments/checkout` — create a pending order and return the hosted checkout URL.
- `GET /api/payments/callback` — verify the invoice after checkout redirect.
- `POST /api/payments/webhook` — validate the configured challenge and independently verify completed invoices.
- `GET /api/certificates` — return the signed-in learner's certificates, progress and configured prices.

## Go-live checklist

- Configure all server-only keys and webhook challenge in Vercel.
- Confirm the Supabase service role key is present.
- Test successful, failed, cancelled, duplicate-webhook and mismatched-amount transactions with sandbox credentials.
- Complete merchant verification and switch to live credentials only after successful sandbox tests.
- Ensure course completion records are written only after actual course requirements are met.
