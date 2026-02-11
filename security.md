1

v

Never Paste
Your Secrets

The Problem: Al models learn from
data. When you paste API keys,
passwords, or database URLs into
the chat, you're potentially
exposing them.

The Fix: Use environment variables
with .env files. Tell your Al: "Use
process.env.API_KEY instead of
hardcoding credentials."

Why it matters: One leaked key =
hackers own your entire app.

Beware of
"Ghost" Packages

The Problem: Al sometimes
invents libraries that don't exist.
Hackers create malware with these
names hoping you'll install them.

The Fix:
Always verify packages exist before
installing. Ask Al: "Show me the
npm or PyPI link for this package."

Why it matters: Most
vulnerabilities come from supply
chain attacks ..

Ditsthatla

3

Don't Trust
Al-Built Auth

The Problem: Al will happily
generate a custom login system.
It will look like it works. It will
have security holes you can't see.

The Fix: Use battle-tested
providers: Clerk, Supabase Auth,
AuthO, or NextAuth. Tell Al:
"Implement authentication using
Clerk."

Why it matters: Authentication is
where 90% of data breaches start.


4
a Security Review

The Problem: Al writes code to
work, not to be secure. It often
skips security checks entirely.

The Fix: After code works, prompt:
"Act as a senior security engineer.
Review this code for vulnerabilities
like SQL injection, XSS, and
insecure data handling."

Why it matters: You don't need to
understand every fix - just knowing
the vulnerabilities exist is step one.

Always Ask for

5

The Problem: Al often writes code
that takes user input and dumps it
directly into your database. This is
how hackers delete your data.

The Fix: Explicitly tell Al: "Ensure
all database queries use
parameterized queries to prevent
SQL injection."

Why it matters: One unsanitized
form field = total database
compromise.

Sanitize Every
Single Input

6

Master the
.gitignore

The Problem: Vibe coding moves
fast. You'll accidentally commit
your .env file with all your secrets
to GitHub.

The Fix: First thing in every new
project: "Create a .gitignore that
excludes .env, node_modules, API
keys, and system logs."

Why it matters: GitHub is public.
Bots scan for exposed keys 24/7.

7

The Problem: Al's training data
includes old package versions with
known security holes.

The Fix: When installing, ask: "Are
there newer, more secure versions
of these libraries I should use
instead?"

Only Use
Current Packages

Why it matters: Outdated
packages are the #1 easiest hack.

8

Add Rate Limiting
Day One

The Problem: If you vibe code a
contact form, bots will find it and
spam you 1,000 times per second.

The Fix: Always prompt: "Add rate
limiting to this API route - max 100
requests per hour per IP."

Why it matters: Without limits,
someone can drain your API costs
overnight.

9

Ask Al to Hack You
(Seriously)
The Problem: You don't know
what you don't know about
security.

The Fix: Open your code in the Al
editor and prompt: "You're a
hacker trying to break this app. Tell
me every vulnerability you find and
how to exploit it. Then tell me the
fix."

Why it matters: Al knows attack
patterns - use that knowledge
defensively.

Enable RLS
from day 0

The Problem: By default,
databases let anyone see
everyone's data. Yes, really.

The Fix: Tell Al: "Set up Row Level
Security (RLS) policies so users can
only access their own data."
Double-check this happened.

Why it matters: This is literally
how data leaks happen - someone
forgets RLS.

10

10

Vibe coding moves fast.

But these 10 rules take 2 minutes
each and prevent 99% of hacks.

Security isn't paranoia - it's
showing respect for people's data.

I'll be doing Part 2 next week -
comment what security topics you
want covered.

REMEMBER:

