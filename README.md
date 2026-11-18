# Syau Sathi Backend

NestJS API using Fastify, PostgreSQL, TypeORM, and Vitest.

## Feature modules

Farmer registration and login are separate feature modules:

- [`FarmerRegistrationModule`](./src/auth/farmer-registration/farmer-registration.module.ts)
  owns registration OTP requests, verification, and farmer account creation.
- [`FarmerLoginModule`](./src/auth/farmer-login/farmer-login.module.ts) owns
  login OTP authentication.
- [`AuthModule`](./src/auth/auth.module.ts) composes those modules and owns
  refresh, logout, and the authenticated `/me` endpoint.
- `OtpModule`, `TokenModule`, and `UserModule` provide shared OTP, token, and
  farmer persistence capabilities.

## Local setup

1. Install dependencies and prepare the local environment:

   ```bash
   npm install
   cp .env.example .env
   ```

2. Set PostgreSQL connection values in `.env`, create the configured database,
   and replace `JWT_ACCESS_SECRET` and `OTP_HASH_SECRET`
   with separate random secrets. For example, run `openssl rand -base64 32`
   twice.
3. Apply the schema migration and start the API:

   ```bash
   npm run migration:run
   npm run start:dev
   ```

4. In development, request an OTP and read it from the backend terminal. The
   development provider refuses to run in production. Sparrow delivery remains
   a provider stub until credentials and the API integration are available.

The API listens on `http://localhost:3000/api/v1`. Phone numbers are validated
as 10-digit Nepal mobile numbers (accepting both ASCII and Devanagari digits)
and normalized to E.164 (`+977...`). OTP requests are limited to one per phone
and flow every 60 seconds and five requests per hour. OTPs expire after five
minutes and allow at most three verification attempts. Sessions use 15-minute
JWT access tokens and 90-day rotating refresh tokens.

TypeORM schema synchronization is disabled; use migrations to change the
database. This migration may upgrade existing user data and is intentionally
not reversible; restore a database backup to roll it back.
The latest incremental migration also ensures the optional `treeCount` and
`orchardType` profile columns exist, including when the original schema
migration was already applied.

## Authentication endpoints

All responses use `{ "success": boolean, "message": string, "data": ... }`.
Error responses have `data: null`. Tokens and phone numbers below are examples.

### Register: request OTP

`POST /api/v1/auth/farmer/register/send-otp`

Request:

```json
{ "phoneNumber": "9812345678" }
```

Response (`202 Accepted`):

```json
{
  "success": true,
  "message": "OTP request accepted. Check your phone if the number is eligible.",
  "data": null
}
```

### Register: verify OTP

`POST /api/v1/auth/farmer/register/verify-otp`

Request:

```json
{ "phoneNumber": "9812345678", "otp": "123456" }
```

Response (`200 OK`):

```json
{
  "success": true,
  "message": "Farmer registered successfully.",
  "data": {
    "accessToken": "<access-token>",
    "refreshToken": "<refresh-token>",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "isProfileComplete": false,
    "user": {
      "id": "<uuid>",
      "phoneNumber": "+9779812345678",
      "role": "FARMER"
    }
  }
}
```

### Login: request OTP

`POST /api/v1/auth/farmer/login/send-otp`

Request:

```json
{ "phoneNumber": "+9779812345678" }
```

Response (`202 Accepted`) is the same generic response as registration OTP
request, whether or not an active farmer account exists.

```json
{
  "success": true,
  "message": "OTP request accepted. Check your phone if the number is eligible.",
  "data": null
}
```

### Login: verify OTP

`POST /api/v1/auth/farmer/login/verify-otp`

Request:

```json
{ "phoneNumber": "+9779812345678", "otp": "123456" }
```

Response (`200 OK`) has the same token and user shape as registration
verification, with `isProfileComplete` reflecting the account. Invalid OTPs
and unknown/inactive accounts return a generic `401 Unauthorized` response.

```json
{
  "success": true,
  "message": "Farmer logged in successfully.",
  "data": {
    "accessToken": "<access-token>",
    "refreshToken": "<refresh-token>",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "isProfileComplete": true,
    "user": {
      "id": "<uuid>",
      "phoneNumber": "+9779812345678",
      "role": "FARMER"
    }
  }
}
```

### Refresh tokens

`POST /api/v1/auth/refresh`

Request:

```json
{ "refreshToken": "<refresh-token>" }
```

Response (`200 OK`):

```json
{
  "success": true,
  "message": "Tokens refreshed successfully.",
  "data": {
    "accessToken": "<new-access-token>",
    "refreshToken": "<new-refresh-token>",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

The submitted refresh token is revoked as part of rotation. Only a hash is
stored in PostgreSQL.

### Logout

`POST /api/v1/auth/logout`

Request:

```json
{ "refreshToken": "<refresh-token>" }
```

Response (`200 OK`):

```json
{ "success": true, "message": "Logged out successfully.", "data": null }
```

### Current farmer

`GET /api/v1/auth/me`

Send `Authorization: Bearer <access-token>`.

Response (`200 OK`):

```json
{
  "success": true,
  "message": "Farmer profile retrieved successfully.",
  "data": {
    "user": {
      "id": "<uuid>",
      "phoneNumber": "+9779812345678",
      "role": "FARMER",
      "fullName": null,
      "district": null,
      "municipality": null,
      "wardNumber": null,
      "treeCount": null,
      "orchardType": null,
      "profilePhoto": null,
      "isProfileComplete": false
    }
  }
}
```

### Complete farmer profile

`POST /api/v1/users/farmer/complete-profile`

Send `Authorization: Bearer <access-token>`.

Request (`district` is required; `fullName`, `municipality`, `wardNumber`, `treeCount`, `orchardType`, and `profilePhoto` are optional):

```json
{
  "fullName": "डोल्मा गुरुङ",
  "district": "मुस्ताङ",
  "municipality": "घरपझोङ गाउँपालिका",
  "wardNumber": 4,
  "treeCount": 40,
  "orchardType": "TRADITIONAL",
  "profilePhoto": "https://example.com/profile.jpg"
}
```

`orchardType` accepts `TRADITIONAL`, `HIGH_DENSITY`, or `BOTH`. `profilePhoto` is optional and must be an HTTPS URL.

Response (`200 OK`):

```json
{
  "success": true,
  "message": "Farmer profile completed successfully.",
  "data": {
    "user": {
      "id": "<uuid>",
      "phoneNumber": "+9779812345678",
      "role": "FARMER",
      "fullName": "डोल्मा गुरुङ",
      "district": "मुस्ताङ",
      "municipality": "घरपझोङ गाउँपालिका",
      "wardNumber": 4,
      "treeCount": 40,
      "orchardType": "TRADITIONAL",
      "profilePhoto": "https://example.com/profile.jpg",
      "isProfileComplete": true
    }
  }
}
```

The server derives the profile owner from the access token. Client-provided
role, status, or user ID fields are rejected.

## Migrations and tests

```bash
npm run migration:show
npm run migration:run
npm test
npm run test:e2e
npm run build
```
