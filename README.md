# Private downloads from DigitalOcean Spaces

A small Next.js app for rehearsing private file delivery. An authenticated owner requests an allowlisted file ID. The server checks ownership and returns a 60-second presigned GET URL. The browser downloads directly from the Spaces origin.

This is a local teaching example. It uses two demo accounts and HTTP Basic Auth so the ownership check works without a separate identity provider. Never expose it publicly as your customer login system. Basic Auth requires HTTPS outside localhost and has awkward browser logout behavior. The npm run commands bind to localhost on purpose. Routes reject non-loopback hostnames and refuse production mode unless `LOCAL_REHEARSAL=1`; `npm start` sets that flag only for the local production-build check. Do not set that flag on hosting services or put this app behind a public proxy.

The [full walkthrough](https://www.tylor.nz/content/spaces-private-downloads) is awaiting site publication. Until then, use the complete setup instructions below.

This README contains an affiliate link. If you sign up through it, I may earn a commission at no extra cost to you. If Spaces fits your project, [Visit DigitalOcean](https://www.tylor.nz/go/digitalocean?utm_source=github&utm_medium=affiliate&utm_campaign=digitalocean-guides&utm_content=spaces-private-downloads&product=spaces&placement=companion-readme&variant=private-downloads&locale=en). Creating a Spaces bucket starts paid billing; a signup offer does not make storage permanently free.

## Requirements

- Node.js 22 or newer and npm.
- A macOS or Linux shell with Git and OpenSSL. On Windows, run these commands in WSL with Node.js, Git, and OpenSSL installed there.
- A DigitalOcean Spaces bucket with the CDN disabled for this exercise.
- A Spaces access key with read access restricted to this bucket. Read also allows listing and other read metadata operations across that bucket; it is not permission for only one file. Use a separate upload credential or the control panel to add your test files.

Use harmless text files while testing. An expiring URL does not erase a downloaded copy and is not a one-time link. Anyone holding it can download the file until expiry.

## Configure the bucket

Create a separate private bucket with a name that contains no dots, such as your own unique variant of `private-download-rehearsal`. Keep file listing private. A private listing alone does not make every object private, so check each uploaded file's permissions too. A new bucket avoids inherited public policies. Limited access keys cannot coexist with an existing `PutBucketPolicy` policy, so use a separate bucket without one for this exercise.

Upload these two small text files through the control panel, preserving these exact object keys:

| Key | Contents for the exercise |
| --- | --- |
| `private/iris/report.txt` | `Sample report for Iris.` |
| `private/milo/report.txt` | `Sample report for Milo.` |

Set each file's permission to private and metadata `Cache-Control` to `private, no-store`. Do not reuse files that were public or served through a CDN. If you must migrate those, first address public permissions and previously cached copies.

## Run locally

Clone the companion repository:

```sh
git clone https://github.com/TylorMayfield/spaces-private-downloads.git
cd spaces-private-downloads
```

If you already have the website repository, use `cd examples/spaces-private-downloads` instead. From this directory:

```sh
npm ci
cp .env.example .env.local
```

Edit `.env.local` with your bucket, region, and Spaces credentials. `SPACES_REGION` is the bucket's DigitalOcean region, such as `nyc3`. The AWS SDK uses `us-east-1` internally; the endpoint selects the actual DigitalOcean region.

Generate a separate password for each demo account:

```sh
openssl rand -hex 24
openssl rand -hex 24
```

Put the first result in `DEMO_IRIS_PASSWORD` and the second in `DEMO_MILO_PASSWORD`. Each must contain at least 24 characters. Leave secrets in `.env.local`, which git ignores. Never add `NEXT_PUBLIC_` to these variables.

```sh
npm test
npm run dev
```

Open http://127.0.0.1:3011. Click **Sign in to the demo** and enter username `iris` with its password in the browser authentication dialog. Follow **Return to downloads**, then click Iris's download button.

Iris's report should download. Milo's button should show `File not found.` Try `milo` in a separate browser profile because browsers remember Basic Auth credentials. Closing a tab does not reliably sign you out.

The page does not print signed URLs. If you open an API route directly, its JSON includes a secret-bearing URL. Do not paste it into tickets, analytics, public chats, or screenshots.

## What the code checks

`lib/downloads.mjs` verifies the Basic Auth password on the server using a constant-time digest comparison. It then looks up the requested ID in a fixed catalog. The authenticated user's identity must match that file's owner before the signer runs. Unknown IDs and another owner's files both return 404.

The client never submits an object key. Changing the URL to `milo-report`, `constructor`, or a path cannot make Iris sign Milo's file. Signing does not contact Spaces or prove that the object exists. A missing object or invalid cloud key can still produce a URL that fails when used.

`app/api/downloads/[id]/route.js` is a dynamic Node.js route. Every response, including failures, uses `Cache-Control: private, no-store`. The signed GET also requests `private, no-store` for the file response and attachment download behavior. It uses the regional origin hostname, not a CDN or custom-domain rewrite.

DigitalOcean documents that presigned transfers are not cached by its CDN and may incur double bandwidth charges if routed through it. Use the origin URL exactly as signed.

## Check the real bucket before using this pattern

Local tests cannot establish your bucket permissions or Spaces' live expiry behavior. After configuring the real bucket, verify these separately with GET requests. A HEAD request is a different HTTP method and is not a valid test of a GET signature.

1. Open each plain origin object URL without query parameters in a private browser window. It must fail with an access-denied response. A successful download means the object is public. Stop and fix permissions before continuing.
2. Request Iris's report while signed out. The API must return 401. A wrong password must also return 401.
3. Sign in as Iris and request `/api/downloads/milo-report`. Expect 404. Request an unknown ID and expect the same result.
4. Generate a fresh Iris link and download it immediately. Confirm the contents belong to Iris and inspect the response headers for `Cache-Control: private, no-store` and attachment disposition.
5. Keep that exact URL privately. Wait at least 70 seconds, then request it again with a fresh GET. It should fail. Do not click the app button again for this test, because that generates a new URL.
6. Generate a new link to confirm that authorized users can still request a download after the old one expires.

An already-started transfer may finish after expiry. A successful download can persist on disk. Cache headers and expiry cannot retract a copy or prevent a recipient sharing the URL before it expires.

## Tests and their limits

```sh
npm test
npm run build
npm audit
npm start
```

The tests check authentication rejection, ownership isolation, unknown and malicious IDs, failure response caching, configuration errors, and the actual AWS SDK signature's hostname, object path, expiry and response headers. Fake credentials are intentional. These tests do not send requests to DigitalOcean and do not claim to verify live storage permissions, expiry enforcement, downloads, or billing.

The fixed catalog is a teaching fixture. Before adapting this for customers, replace demo authentication with your existing server-side session validation and query your database for current file ownership or purchase entitlement. Add rate limits, production monitoring that redacts credentials and query strings, HTTPS, secure secret storage and a plan for key rotation. Never trust a user ID, paid flag, or object key sent by the browser.

## Sources

- [DigitalOcean AWS SDK configuration](https://docs.digitalocean.com/products/spaces/reference/aws-sdks/)
- [DigitalOcean file permissions](https://docs.digitalocean.com/products/spaces/how-to/set-file-permissions/)
- [DigitalOcean sharing links](https://docs.digitalocean.com/products/spaces/how-to/set-file-permissions/)
- [AWS presigned URL behavior](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)
