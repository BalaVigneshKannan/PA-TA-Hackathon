# University intranet connection

The portal now provides a signed-assertion interface at `POST /api/auth/intranet`. It is disabled until configured. This is an integration contract for the university's authenticated intranet; it does not claim to be a configured OIDC, SAML, or academic-system connection. The university must implement the assertion issuer using its existing authentication and authoritative academic records.

## Configure the portal

Run `npm.cmd run db:migrate` with the embedded preview stopped, then set these values in `backend/.env`:

```dotenv
UNIVERSITY_DOMAIN=dubai.bits-pilani.ac.in
INTRANET_ISSUER=https://your-university-intranet.example
INTRANET_AUDIENCE=pa-ta-portal
INTRANET_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

Use an RSA public key of at least 2048 bits. Only the university issuer holds the corresponding private key. `JWT_SECRET` remains the separate portal session secret. Partial intranet configuration fails at startup rather than silently accepting an incomplete setup.

Serve the intranet and portal behind the same HTTPS origin. Set `APP_ORIGIN` to that origin and `NODE_ENV=production`. The endpoint retains the portal's origin checks, rate limiting and HttpOnly session cookies. The university's server must derive identity and role from its authenticated session; it must never sign browser-supplied roles or academic values.

## Signed assertion

Send JSON `{ "assertion": "<RS256 JWT>" }` with `Content-Type: application/json`. The entire request must fit within the portal's 16 KB request limit. Required claims:

| Claim | Contract |
|---|---|
| `iss`, `aud` | Exactly match the configured issuer and audience. |
| `sub` | Stable university account identifier, up to 200 characters. |
| `jti` | Unique single-use token identifier, up to 200 characters. |
| `iat`, `exp` | Integer Unix seconds; issue now, expire within five minutes. |
| `email`, `email_verified` | Verified university email; `email_verified` must be `true`. |
| `name` | Nonempty display name, up to 150 characters. |
| `role` | `STUDENT`, `FACULTY`, or `ADMIN`, assigned by the university. |
| `academic` | Optional complete academic snapshot for a student, described below. |

The university can sign the following payload with its private key using its existing JWT library. This example omits signing keys and uses illustrative values:

```json
{
  "iss": "https://your-university-intranet.example",
  "aud": "pa-ta-portal",
  "sub": "stable-university-account-id",
  "jti": "new-random-token-id-for-each-launch",
  "iat": 1790900000,
  "exp": 1790900120,
  "email": "student@dubai.bits-pilani.ac.in",
  "email_verified": true,
  "name": "Student Name",
  "role": "STUDENT",
  "academic": {
    "student_id": "20260001",
    "programme": "Computer Science",
    "current_year": 3,
    "cgpa": 8.75,
    "courses": [{ "course_code": "CS F301", "grade": "A" }]
  }
}
```

Replace timestamps with the current time. Academic snapshots require a nonempty student ID and programme, year 1–6, CGPA 0–10 with up to two decimal places, and a complete list of at most 100 course/grade records. Codes normalize to the portal's course-code format; duplicates are rejected. A supplied list replaces the previous transcript atomically, including an empty list. Omit `academic` to retain the previously loaded profile. Without a profile, a student can sign in but cannot apply. Unsupported or failing grades never satisfy eligibility.

Existing submitted applications retain their original academic and eligibility snapshots. New opportunities evaluate the latest authoritative data. Final result snapshots retain the original selection information and use a stable internal student identity, including compatibility with older result records.

## Launch from the intranet

The university should obtain an assertion through its authenticated server route, then exchange it from the same origin:

```js
// assertion comes from the authenticated university server, not a user-editable form.
const response = await fetch('/api/auth/intranet', {
  method: 'POST',
  credentials: 'same-origin',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ assertion })
});
const result = await response.json();
if (!response.ok) throw new Error(result.error);
window.location.assign('/login'); // restores the session and opens the correct role workspace
```

Do not put the assertion in a URL or browser storage. A successful exchange returns the public user and issues the normal eight-hour revocable session. Used assertion IDs are stored in the database to prevent concurrent replay. Expired assertion records are cleaned during subsequent exchanges.

New student and assigned faculty identities can be provisioned without local passwords. An `ADMIN` must already have a matching, active staff account. Existing account roles cannot be changed through this interface, and an identity cannot be relinked to another institutional subject. Faculty authorization still requires an assigned core course in the active semester on every protected request. Disabled accounts cannot sign in or continue using old sessions. Existing local password accounts continue to work.

## Remaining university inputs

The actual identity-provider protocol, issuer implementation, approved role mapping, signing key, academic-data source, course list and grade policy must be supplied and confirmed by the university. The included demo remains synthetic until connected. Standalone PostgreSQL deployment and the live university connection require environment-specific verification.
