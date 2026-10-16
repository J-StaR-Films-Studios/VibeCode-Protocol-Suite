---
name: resend-company
description: Use when implementing or reviewing product email, contact forms, auth emails, sender configuration, Reply-To routing, or email setup under J StaR's shared-domain Resend convention.
author: J StaR Films
coauthored: J StaR Films / Takomi
version: 1.0.0
---

# Resend company convention

Use this policy for company products unless the user explicitly approves a different arrangement. Read the target repository's email implementation and environment documentation before changing it. Keep its existing framework, configuration names, and provider integration.

## Shared sending identity, scoped keys

The company uses the verified sending domain `jstarstudios.com`. Products can send from the shared mailbox address `hey@jstarstudios.com` with their own display names:

```text
Melo <hey@jstarstudios.com>
Melo Preview <hey@jstarstudios.com>
Your Product <hey@jstarstudios.com>
```

The display name identifies the product. It does not require another verified domain. Do not use a visitor's address or an unverified product domain as `From`.

"One key and one sender" means reusing the approved product/environment key and sender across that product's sending runtimes. It does not mean sharing one secret across the whole company.

- Use separate Resend API keys per product and environment. The documented Melo names are `melo-preview` and `melo-production`.
- Use sending-only access restricted to `jstarstudios.com`.
- Reuse the same product/environment key in its website server and backend when its permissions permit the sender.
- Keep Preview and Production keys distinct. Do not borrow another product's key.
- Do not create keys, change DNS, install runtime secrets, revoke keys, deploy, or send real email without approval for the exact target.

## Separate From, To, and Reply-To

`From` is the approved company sending identity. `To` is the intended recipient. `Reply-To` is where a human reply should go. Changing Reply-To does not change the sender or send an extra copy.

For a contact form, send two separate messages:

| Message | From | To | Reply-To |
| --- | --- | --- | --- |
| Team notification | Product sender | Product team inbox | Validated visitor email |
| Visitor acknowledgement | Product sender | Validated visitor email | Product team inbox |

Melo's documented team inbox is `melo@jstarstudios.com`. For a new product, ask for its approved inbox. Do not invent a mailbox or assume an address exists because its domain is verified.

For signup verification, password reset, and other private transactional messages, send to the intended account or transaction recipient. Do not redirect or copy those messages to the contact inbox. Choose Reply-To for those flows only from the product's approved policy.

Resend domain verification proves sending readiness, not that a mailbox receives email. Mailbox hosting, inbound forwarding, and reply delivery need separate confirmation. Reply-To does not configure any of them.

## Configure every sending runtime

Keep `RESEND_API_KEY` server-only. Never put it in client code, public environment variables, source control, chat, examples, or logs. Collect and inject credentials through the available private secret tools or user-managed private configuration.

Each runtime needs its own environment entries even when their values match. Setting a key in a website host does not configure its backend. Saving a local collection file does not configure either live runtime.

Melo uses:

| Setting | Website server | Convex backend |
| --- | --- | --- |
| `RESEND_API_KEY` | Product/environment key | Same approved product/environment key |
| `MELO_EMAIL_FROM` | Product/environment sender | Same approved sender |
| `MELO_CONTACT_TO` | Reviewed contact inbox | Not required merely for website contact routing |

For other products, preserve existing sender and recipient variable names. If none exist, agree on them before implementing. Do not impose Melo-specific names on another application.

Treat fallback behavior as application-specific. Melo's website has sender and recipient defaults, but that is not permission to assume another runtime does. Verify the actual code and document required settings.

## Implement and check

1. Identify the product, environment, sending runtimes, verified sender, team inbox, and message types. Ask about missing choices before making external changes.
2. Keep provider calls on the server. Validate public form input, escape user content in HTML email, and preserve the application's abuse controls.
3. Check provider errors as well as thrown exceptions. A resolved SDK call is not proof of acceptance. Use the installed SDK's types and require the expected message ID.
4. For Melo-style contact forms, send the team notification first. If it fails, report failure and do not send the acknowledgement. If the notification succeeds but the acknowledgement fails, report that partial result without treating the notification as unsent. Do not blindly repeat both messages.
5. Mock the provider for focused tests. Check From, To, Reply-To, missing configuration, provider rejection, and acknowledgement-only failure where applicable. Do not add a new email abstraction merely to follow this policy.
6. Before a live test, obtain approval for the environment and exact recipients. Use controlled test inboxes. A Preview key does not prevent email reaching real people, especially with copied Production data.
7. Distinguish local configuration, live runtime configuration, provider acceptance, mailbox delivery, and successful reply routing in the completion report. Claim only what was checked.

For key rotation, configure and verify the replacement before revoking the old key. Revocation requires separate approval. Do not alter unrelated auth, signing, billing, or provider credentials.

## Origin of this policy

Extracted from the Melo repository's `docs/features/Production_Environment_Inventory.md`, sections "Resend provider step" and "Confirmed Preview email routing", and `apps/www/lib/server/contact-email.ts`.

These are source references, not dependencies on a particular checkout. This skill contains the reusable policy. Past verification of `jstarstudios.com` and user confirmation of the Melo inbox are not fresh evidence for a future deployment. Recheck the relevant provider and mailbox state before claiming live readiness.
