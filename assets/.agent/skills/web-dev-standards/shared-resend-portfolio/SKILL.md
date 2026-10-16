---
name: shared-resend-portfolio
description: Use when adding or reviewing transactional email across products on one Resend account and verified domain, including J StaR's shared sender, per-product keys, contact routing, and delivery checks.
author: J StaR Films
coauthored: J StaR Films / Takomi
version: 1.1.0
---

# Shared Resend Portfolio

Implement email for multiple products through one Resend account and verified domain. Optimize for a solo developer or small portfolio using the free tier without making every app look like the same product.

## Core model

Share infrastructure, not product identity:

```text
One Resend account
└── Existing verified sender domain
    ├── Product A sender identity
    ├── Product B sender identity
    └── Product C sender identity
```

Each app keeps its own:

- sender display name
- destination inbox
- Reply-To routing
- subject conventions
- branded HTML and plain-text templates
- deployment environment variables
- delivery logs and failure behavior

All apps share the account-level free-tier quota and verified-domain reputation.

## Portfolio discovery

Before implementation:

1. Inspect the target app and any sibling app with a working Resend setup.
2. Identify the canonical Resend account and already verified domain.
3. Confirm the product display name, shared sender mailbox, internal recipient, support Reply-To inbox, and expected email types.
4. Confirm whether the target deployment already has a Resend API key.
5. Do not ask the user to create another account, verify another domain, or buy a plan unless the existing account cannot meet a stated requirement.

## Account and key strategy

Reuse the same Resend account and verified domain. Prefer a separate API key per deployed app when the account permits it; this limits the impact of a leaked or rotated key while remaining on one account and quota. Reuse the same key only when separate keys are unavailable or the user explicitly prefers that trade-off. For J StaR products, follow the stricter product-and-environment key policy below.

Never copy secrets from another repository into source control. Add the selected key directly to each deployment’s secret environment.

## Per-product configuration

Use server-only variables and product-specific names where practical. Resolve their values from the user's existing Resend account, verified sender configuration, and intended product inbox—never copy example identities into an implementation.

| Variable role | Purpose |
|---|---|
| Resend API key | Authenticates the server-side provider call |
| Product sender identity | Combines the current product's display name with an address on the existing verified domain |
| Product contact recipient | Receives this product's internal notifications |
| Product reply address | Receives replies to user-facing messages when different from the contact recipient |

The visible display name supplies product identity; the existing verified address supplies deliverability. Never use a `NEXT_PUBLIC_` or equivalent client-exposed variable for an API key.

## Contact-form routing

Send two separate messages:

```text
Internal notification
From: configured product sender identity
To: configured internal product inbox
Reply-To: validated address submitted by the visitor

Visitor confirmation
From: configured product sender identity
To: validated address submitted by the visitor
Reply-To: configured internal product inbox
```

Do not put the visitor and internal inbox in one recipient list. Separate messages prevent address exposure and allow different content.

Treat the internal notification as primary delivery. Return form success only after Resend accepts it and returns a message ID. Attempt visitor confirmation afterward; log its failure without claiming the primary enquiry was lost.

## Brand isolation

Create a distinct template shell for each product while keeping the provider module pattern reusable. Customize:

- product name and descriptor
- colors, typography, and header treatment
- email preview text
- subjects and tone
- footer ownership, support address, and response expectations

Use table layouts, inline CSS, a 600–640px content width, escaped user values, and a plain-text version. Do not reuse another product’s visual identity merely because the sender infrastructure is shared.

## Shared free-tier safeguards

- Check the current Resend free-tier limits rather than relying on remembered numbers.
- Remember that every app consumes the same account quota.
- Send only necessary transactional messages; avoid duplicate notifications.
- Keep anti-spam controls on public forms: validation, length limits, honeypot, and rate limiting where appropriate.
- Avoid retry loops that can send duplicates. Persist or use idempotency where the workflow has meaningful retry risk.
- Monitor provider rejections and quota errors without logging secrets or unnecessary personal data.
- Escalate to another account or paid plan only when measured volume, isolation, compliance, or reputation requirements justify it.

## Reliable implementation

1. Install the official `resend` package in the correct workspace.
2. Keep provider calls in a server-only module.
3. Validate `result.data?.id` and ensure `result.error` is absent.
4. Catch SDK and network exceptions.
5. Set `replyTo` explicitly.
6. Return `503` when email is not configured and `502` when primary delivery fails.
7. Preserve direct email, phone, or messaging fallbacks in the UI.
8. Never report log-only handling as successful delivery.

## Verification

- Confirm the shared domain is verified in the reused Resend account.
- Confirm the product-specific From, To, and Reply-To values.
- Test internal delivery, then visitor confirmation, then replying in both directions.
- Test validation, honeypot, missing-key, provider-rejection, and fallback paths.
- Run repository-native typecheck, lint, test, and build commands.
- Confirm the deployment contains its API key and product variables.
- Obtain approval for the target environment and exact recipients before a live submission. Perform one real submission before claiming live delivery works.

## J StaR company convention

Use this section for company products unless the user approves a different arrangement. Read the target repository's email implementation and environment documentation first. Keep its framework, configuration names, and provider integration.

The shared verified sender domain is `jstarstudios.com`; the shared mailbox address is `hey@jstarstudios.com`. Display names identify each product, for example `Melo <hey@jstarstudios.com>` or `Melo Preview <hey@jstarstudios.com>`. Do not use a visitor's address or an unverified product domain as `From`. Confirm the sender and mailbox are still valid for the target environment. Domain verification does not prove that a mailbox receives replies; check inbound hosting or forwarding separately.

- Use separate sending-only Resend API keys per product and environment, restricted to `jstarstudios.com`. Melo's documented key names are `melo-preview` and `melo-production`. Do not borrow another product's key or use a Preview key for Production.
- Reuse an approved product/environment key in that product's website server and backend when its permissions allow it. Each runtime needs its own environment configuration even when the values match. Keep `RESEND_API_KEY` server-only; never put it in client code, public environment variables, source control, chat, examples, or logs. Obtain secrets through private tools or user-managed private configuration.
- Do not create keys, change DNS, install runtime secrets, revoke keys, deploy, or send real email without approval for the exact target. Configure and verify a replacement key before separately approving revocation of the old one. Do not alter unrelated credentials.
- For a contact form, send the internal notification to the approved product inbox first, with the validated visitor email as `Reply-To`. Then send a separate acknowledgement to the visitor with the approved product inbox as `Reply-To`. A failed notification stops the acknowledgement; a failed acknowledgement after a successful notification is partial success, not a lost enquiry. Do not blindly resend both.
- Melo's documented team inbox is `melo@jstarstudios.com`. Ask for other products' approved inboxes instead of inventing them. For verification, password reset, and other private transactional emails, send only to the intended account or transaction recipient; choose their `Reply-To` from the product policy, not from the contact form rule.
- Melo uses `RESEND_API_KEY` and `MELO_EMAIL_FROM` in both its website server and Convex backend, plus `MELO_CONTACT_TO` in the website server for contact routing. Preserve other products' existing variable names; agree on names if missing. Check actual fallback behavior in each runtime instead of assuming Melo's website defaults apply to its backend or another product.
- Validate input, escape user content in HTML email, preserve abuse controls, and check provider errors as well as exceptions. A resolved SDK call alone is not acceptance: require the expected message ID. Mock From, To, Reply-To, missing configuration, rejection, and acknowledgement-only failure in focused tests. Do not introduce an email abstraction just to follow this policy.
- Before a live test, confirm the environment and recipients and use controlled inboxes. Preview credentials can still deliver to real people, especially with copied Production data. Report local configuration, deployed configuration, provider acceptance, mailbox delivery, and reply routing separately; claim only what was checked.

This convention comes from the Melo repository's `docs/features/Production_Environment_Inventory.md` ("Resend provider step" and "Confirmed Preview email routing") and `apps/www/lib/server/contact-email.ts`. Those paths record the policy's origin, not a dependency on a particular checkout. Recheck provider and mailbox state before claiming current readiness.
