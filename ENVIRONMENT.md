# CHOVIA Environment Setup

This repository contains multiple independently configured applications. Do not put all environment variables in one root `.env` file.

## Backend

1. Copy `backend/.env.example` to `backend/.env`.
2. Set `DATABASE_URL` (PostgreSQL 18 + PostGIS; optional `DIRECT_URL` for Neon migrations) and `REDIS_URL` (`redis://...` locally, `rediss://...` in staging/production).
3. Set distinct `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `OTP_HMAC_SECRET` (at least 32 characters each). Development defaults exist in code for `development`/`test`, but explicit local values are preferable.
4. Set `KYC_ENCRYPTION_KEY` to a 64-character hex string (32 bytes for AES-256-GCM encryption of rider NIN/BVN/ID numbers and bank account numbers). In production/staging this is mandatory and default dev keys are rejected.
5. Configure the integrations you intend to test. Placeholder Paystack, Cloudinary, Resend, and Google Maps values are not usable credentials:
   - **Paystack (`PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_WEBHOOK_SECRET`)**: Real Paystack test keys (`sk_test_...`) work in local development; `sk_live_...` is strictly required in production.
   - **Cloudinary (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`)**: Required when `MOCK_INTEGRATIONS=false` for avatar uploads and private authenticated KYC document uploads.
   - **Resend (`RESEND_API_KEY`, `EMAIL_FROM`)**: Requires a valid `re_...` key for OTP/password-reset email delivery when `MOCK_INTEGRATIONS=false`.
   - **Google Maps (`GOOGLE_MAPS_API_KEY`)**: Required for routing/geocoding when `MOCK_INTEGRATIONS=false`.
   - **Sentry / Expo Push (`SENTRY_DSN`, `EXPO_ACCESS_TOKEN`)**: Optional locally; required in staging/production.
6. Keep `MOCK_INTEGRATIONS` aligned with your intended test mode (`true` allows local development without external API calls, while `false` exercises real providers). Do not use mock mode as evidence that a real provider integration works.

The backend `.env` is loaded by the backend process and worker process. The monorepo root does not load a root `.env` for the mobile apps.

## Customer mobile app

1. Copy `apps/mobile/customer/.env.example` to `apps/mobile/customer/.env`.
2. Set `EXPO_PUBLIC_API_URL` to the backend API base URL, including `/api/v1`.

## Rider mobile app

1. Copy `apps/mobile/rider/.env.example` to `apps/mobile/rider/.env`.
2. Set `EXPO_PUBLIC_API_URL` to the same backend API base URL, including `/api/v1`.

## Selecting the API URL

- Android emulator: `http://10.0.2.2:4000/api/v1`
- iOS simulator: `http://localhost:4000/api/v1`
- Web running on the development computer: `http://localhost:4000/api/v1`
- Physical Android/iPhone: `http://<DEVELOPMENT_COMPUTER_LAN_IP>:4000/api/v1`

A physical phone's `localhost` refers to the phone, not the development computer. The phone and computer must be on the same reachable network. The backend must listen on `0.0.0.0` (the current backend default) and the computer firewall must allow inbound TCP traffic on port `4000` for the private network.

After creating or changing a mobile `.env`, stop and restart Expo (clearing cache if needed, e.g. `npx expo start -c`) so the `EXPO_PUBLIC_` variable is embedded in the app bundle. These variables are public client configuration: never put API secrets, database credentials, JWT secrets, `KYC_ENCRYPTION_KEY`, or provider secret keys in a mobile `.env` file.

Runtime behavior in `apps/mobile/customer/utils/env.ts` and `apps/mobile/rider/utils/env.ts`:
- Emulators/simulators and Web resolve to `http://10.0.2.2:4000/api/v1` (Android emulator) or `http://localhost:4000/api/v1` (iOS simulator/Web) when `EXPO_PUBLIC_API_URL` is unset.
- Physical devices (`Constants.isDevice === true`) **refuse** to silently fall back to `localhost` or a hardcoded LAN IP and display a clear diagnostic configuration error until `EXPO_PUBLIC_API_URL` is configured.

## Recommended Local Startup Sequence

1. Ensure PostgreSQL (with PostGIS enabled) and Redis are running.
2. Start the backend API server:
   `pnpm --filter @chovia/backend dev`
3. Start the BullMQ background worker (for queued OTP emails, push notifications, and dispatch jobs):
   `pnpm --filter @chovia/backend worker`
4. Start the Customer or Rider mobile app:
   `pnpm --filter @chovia/mobile-customer dev`
   `pnpm --filter @chovia/mobile-rider dev`

## Determining Your LAN IP for Physical Devices

Run `ipconfig` (Windows) or `ifconfig` / `ip addr` (macOS/Linux) to find your active Wi-Fi IPv4 address (for example `http://192.168.1.50:4000/api/v1`; previously observed as `172.20.10.2` on a temporary network) and place it in each mobile app's `.env` file as `EXPO_PUBLIC_API_URL`. Do not hardcode LAN IP addresses in source code.
