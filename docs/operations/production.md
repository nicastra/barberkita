# Production Operations on Ubuntu 24.04

This runbook deploys CukurPro to one AMD64 Ubuntu 24.04 VPS. Caddy is the only
public container: it owns ports 80 and 443, obtains TLS certificates, proxies
`/api/*` to Hono, and proxies every other path to the static React client.
PostgreSQL, the API, and the client have no host-published ports.

Examples use `app.example.com`. Replace it everywhere with the real hostname.
The Git repository is assumed to be `https://github.com/nicastra/barberkita`.

## 1. Create and secure the deploy account

First create a dedicated key pair on the computer that will administer the VPS
(or on the machine that will later hold the GitHub Actions deployment key). Do
this as your normal local user, **not** on the VPS and not as root:

```sh
ssh-keygen -t ed25519 -C "cukurpro-github-actions" -f ~/.ssh/cukurpro_deploy
```

When prompted for a passphrase, use one if a human will use this key. If the
key is only used non-interactively by GitHub Actions, leave the passphrase
empty and protect the private key with GitHub's encrypted secret storage. The
command creates two files:

- `~/.ssh/cukurpro_deploy.pub` is the **public** key. This is safe to install on
  the VPS and is the value that replaces `REPLACE_WITH_DEPLOY_PUBLIC_KEY`.
- `~/.ssh/cukurpro_deploy` is the **private** key. Never paste it into the VPS
  command, commit it, or send it in chat. The complete contents go only into
  the GitHub `production` environment secret `VPS_SSH_PRIVATE_KEY`.

Display the public key and copy its single, unwrapped line (including the
`ssh-ed25519` prefix and trailing comment):

```sh
cat ~/.ssh/cukurpro_deploy.pub
```

As the VPS provider's initial root user, replace the value assigned to
`DEPLOY_PUBLIC_KEY` below with that copied line and run:

```sh
apt update
apt install -y ca-certificates curl git ufw
adduser --disabled-password --gecos '' deploy
install -d -m 0700 -o deploy -g deploy /home/deploy/.ssh
DEPLOY_PUBLIC_KEY='ssh-ed25519 REPLACE_WITH_DEPLOY_PUBLIC_KEY'
printf '%s\n' "$DEPLOY_PUBLIC_KEY" >>/home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 0600 /home/deploy/.ssh/authorized_keys
usermod -aG sudo deploy
```

The example uses `>>` so an existing administrator key is not overwritten. If
this is a newly created account and the file is empty, it will contain only the
new deployment key. On the local computer, record the public-key fingerprint:

```sh
ssh-keygen -lf ~/.ssh/cukurpro_deploy.pub
```

On the VPS, compare it with the fingerprint(s) installed for `deploy`:

```sh
ssh-keygen -lf /home/deploy/.ssh/authorized_keys
```

The fingerprints should include the same Ed25519 fingerprint. From your local
computer, test the exact key before disabling password or root SSH access:

```sh
ssh -i ~/.ssh/cukurpro_deploy -o IdentitiesOnly=yes deploy@VPS_IP
```

Open a second terminal and confirm key-based login remains available before
changing SSH:

```sh
ssh -i ~/.ssh/cukurpro_deploy -o IdentitiesOnly=yes deploy@VPS_IP
```

The file below is an SSH _drop-in_: Ubuntu's main `/etc/ssh/sshd_config`
normally includes every `.conf` file in `/etc/ssh/sshd_config.d/`. The `99-`
prefix makes this site-specific file load late, after most package defaults.
Create it as root with `sudo` (or run the same commands from a root shell):

```sh
sudo install -d -m 0755 /etc/ssh/sshd_config.d
sudo tee /etc/ssh/sshd_config.d/99-cukurpro.conf >/dev/null <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
EOF
sudo chmod 0644 /etc/ssh/sshd_config.d/99-cukurpro.conf
```

These settings mean:

- `PasswordAuthentication no`: reject ordinary username/password SSH logins.
- `KbdInteractiveAuthentication no`: reject keyboard-interactive prompts,
  which can otherwise provide another password/PAM login path.
- `PermitRootLogin no`: reject direct SSH login as `root`; use `deploy` and
  `sudo` instead.
- `PubkeyAuthentication yes`: allow the Ed25519 key installed in
  `/home/deploy/.ssh/authorized_keys`.

Do not close your current SSH session. From a **second** terminal, first prove
that the deploy key works (the command must succeed before continuing):

```sh
ssh -i ~/.ssh/cukurpro_deploy -o IdentitiesOnly=yes deploy@VPS_IP
```

Then, still as root on the VPS, validate the complete SSH configuration. A
syntax error must be fixed before reloading:

```sh
sudo /usr/sbin/sshd -t
```

Optionally confirm the effective values that `sshd` will use:

```sh
sudo /usr/sbin/sshd -T | grep -E '^(passwordauthentication|kbdinteractiveauthentication|permitrootlogin|pubkeyauthentication) '
```

Only after validation succeeds, reload the service. Reloading keeps existing
connections alive while applying the new policy to new connections:

```sh
sudo systemctl reload ssh
```

Test the deploy key again from the second terminal. Keep that session open
until the test succeeds. If `sshd -t` fails, or the second login fails, do not
close the working session; fix the file and validate again. If you do get
locked out, use the VPS provider's console/recovery terminal to restore access.

Enable the firewall. If SSH uses a custom port, allow that port instead of the
`OpenSSH` profile before enabling UFW.

```sh
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw enable
ufw status verbose
```

## 2. Install Docker Engine and Compose

Use Docker's Ubuntu repository rather than the older distribution package:

```sh
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
printf '%s\n' \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  >/etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
usermod -aG docker deploy
```

The `docker` group is root-equivalent. Log out and back in, then verify as
`deploy`:

```sh
docker version
docker compose version
```

## 3. Prepare DNS and directories

Create an `A` record for `app.example.com` pointing to the VPS IPv4 address.
Create an `AAAA` record only when the VPS has working public IPv6; a stale AAAA
record prevents reliable certificate issuance. Confirm propagation:

```sh
dig +short A app.example.com
dig +short AAAA app.example.com
```

As root, create the persistent locations:

```sh
install -d -m 0755 -o deploy -g deploy /opt/cukurpro
install -d -m 0700 -o deploy -g deploy /var/lib/cukurpro
install -d -m 0700 -o deploy -g deploy /var/lib/cukurpro/backups
install -d -m 0700 -o deploy -g deploy /etc/cukurpro
```

As `deploy`, clone into the empty application directory:

```sh
git clone https://github.com/nicastra/barberkita.git /opt/cukurpro
cd /opt/cukurpro
chmod +x scripts/deploy.sh scripts/backup.sh scripts/restore.sh scripts/test-e2e.sh
```

## 4. Install production secrets

Create `/opt/cukurpro/production.env` from
`deploy/production.env.example`. It must contain these values:

```dotenv
APP_DOMAIN=app.example.com
ACME_EMAIL=ops@example.com
POSTGRES_DB=cukurpro
POSTGRES_USER=cukurpro
POSTGRES_PASSWORD=REPLACE_WITH_A_LONG_RANDOM_URL_SAFE_SECRET
DATABASE_URL=postgres://cukurpro:REPLACE_WITH_A_LONG_RANDOM_URL_SAFE_SECRET@postgres:5432/cukurpro
ALLOWED_ORIGINS=https://app.example.com
PUBLIC_API_BASE_URL=https://app.example.com
AUTH_RATE_LIMIT=10
PUBLIC_RATE_LIMIT=60
RATE_LIMIT_WINDOW_MS=60000
MAX_REQUEST_BODY_BYTES=262144
IMAGE_REGISTRY=ghcr.io/nicastra/barberkita
IMAGE_TAG=0000000000000000000000000000000000000000
```

If the database password contains reserved URL characters, percent-encode it
in `DATABASE_URL`. `ALLOWED_ORIGINS` and `PUBLIC_API_BASE_URL` must be exactly
`https://APP_DOMAIN`. The client image is compiled with that same HTTPS origin,
which keeps browser cookies host-scoped and avoids cross-site authentication.

Create a GitHub token that can only read the three private GHCR packages. Store
it outside the working tree, in `/etc/cukurpro/ghcr.env`:

```dotenv
GHCR_USERNAME=REPLACE_WITH_GITHUB_USERNAME
GHCR_TOKEN=REPLACE_WITH_READ_PACKAGES_TOKEN
```

Restrict both files and confirm the production environment is ignored:

```sh
chmod 0600 /opt/cukurpro/production.env /etc/cukurpro/ghcr.env
git -C /opt/cukurpro status --short --ignored production.env
```

Do not run `docker compose up` manually. The deployment script is the only
supported stack entry point because it enforces backup and migration gates.

## 5. Configure GitHub

In repository Actions settings, create the repository variable `APP_DOMAIN`
with only the hostname, for example `app.example.com`. The publish job embeds
`https://APP_DOMAIN` into the client image.

Create a protected environment named `production`, add required reviewers (or
the desired approval policy), and add these environment secrets:

- `VPS_HOST`: VPS IP address or SSH hostname.
- `VPS_PORT`: SSH port, normally `22`.
- `VPS_USER`: `deploy`.
- `VPS_SSH_PRIVATE_KEY`: the CI-only private deployment key.
- `VPS_SSH_KNOWN_HOSTS`: output of a separately verified
  `ssh-keyscan -H -p 22 VPS_HOST`.

The workflow grants `contents: read` by default. Only the image-publish job
gets `packages: write`; the production deploy job gets no package-write token.
The VPS uses its separate read-only GHCR token.

## 6. First deployment and routine deployment

Every successful push to `main` validates the lockfile install, formatting,
types, unit tests, application build, real-database acceptance/restore flow,
deployment files, and all three AMD64 Docker targets. It then pushes only the
full commit-SHA tags and enters the protected `production` environment before
SSH deployment. No `latest` tag is built or deployed.

For the first manual deployment, use a SHA whose images have already been
published by CI:

```sh
cd /opt/cukurpro
git fetch origin main
DEPLOY_SHA=$(git rev-parse origin/main)
git checkout --detach "$DEPLOY_SHA"
./scripts/deploy.sh "$DEPLOY_SHA"
```

The script validates the SHA and secret-file permissions, uses a temporary
Docker credential directory for GHCR login, starts PostgreSQL, and creates a
custom-format backup before it pulls application images. A new empty database
is also backed up before its first migration. If backup or migration fails,
the application replacement does not start. It then waits for PostgreSQL and
both public HTTPS endpoints, prints pulled image digests, and records current
and previous successful SHA values under `/var/lib/cukurpro`.

Re-running the same SHA is safe: Drizzle migrations are idempotent, the image
references are unchanged, and a new pre-deployment backup is still created.

## 7. Health, TLS, ports, and logs

Run after every deployment:

```sh
curl --fail --show-error --silent https://app.example.com/health
curl --fail --show-error --silent https://app.example.com/api/health
openssl s_client -connect app.example.com:443 -servername app.example.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
cd /opt/cukurpro
docker compose --env-file production.env -f compose.production.yaml ps
docker compose --env-file production.env -f compose.production.yaml logs --tail=100 caddy server server-migrate
sudo ss -lntup
```

The first endpoint is served by the client container through Caddy. The second
checks the API and database. Only `:22`, `:80`, and `:443` should listen
publicly; `:3000`, `:5432`, and the client port must not appear on the host.
Caddy certificate data is persisted in `cukurpro_caddy_data`.

## 8. Release acceptance

CI's clean-database acceptance test proves setup is single-use, the session
cookie contains `HttpOnly`, `Secure`, and `SameSite=Lax`, protected API access,
public and staff bookings, a booking conflict, checkout, and reporting. After
the first production deployment, complete the browser journey in
`docs/release-checklist.md` using non-customer test records, and inspect the
sign-in response in browser developer tools to reconfirm the cookie flags.

Do not call owner setup on an initialized production database merely as a
test. A valid `POST /api/auth/setup` must return `409 SETUP_COMPLETE` after the
first owner exists. Confirm a protected request using an operator-owned test
account and a temporary cookie jar:

```sh
umask 077
curl --fail --show-error --silent \
  -c /tmp/cukurpro-cookie.txt \
  -H 'Content-Type: application/json' \
  --data '{"email":"OPERATOR_EMAIL","password":"OPERATOR_PASSWORD"}' \
  https://app.example.com/api/auth/sign-in
curl --fail --show-error --silent \
  -b /tmp/cukurpro-cookie.txt \
  https://app.example.com/api/auth/me
rm -f /tmp/cukurpro-cookie.txt
```

## 9. Application rollback

An application rollback redeploys the previously successful immutable SHA. It
does not reverse schema changes:

```sh
PREVIOUS_SHA=$(cat /var/lib/cukurpro/previous-image-tag)
cd /opt/cukurpro
git fetch --depth=1 origin "$PREVIOUS_SHA"
git checkout --detach "$PREVIOUS_SHA"
./scripts/deploy.sh "$PREVIOUS_SHA"
```

The deployer creates another backup before rollback and leaves both image tags
in the local Docker cache and GHCR. Confirm both health endpoints and the
representative workflow afterward.

Never automatically reverse migrations. First assess whether the earlier app
is compatible with the current schema. If it is not, schedule downtime and
restore the matching pre-deployment backup using the isolated procedure in
`backup-restore.md`; restoring production data is a separate, explicitly
approved recovery operation and loses changes made after that backup.

## 10. Troubleshooting

- Certificate issuance: verify A/AAAA records, UFW, provider firewalls, and
  `docker compose ... logs caddy`. Ports 80 and 443 must reach this VPS.
- GHCR `denied`: check the token's package read permission, package access for
  `nicastra/barberkita`, and `ghcr.env` username.
- Backup failure: deployment fails closed. Check free space with `df -h`,
  PostgreSQL health/logs, backup-directory ownership, and the URL/user values.
- Migration failure: the existing API is left in place during an update and a
  fresh API is not started on first install. Preserve `server-migrate` logs;
  never mark a migration applied manually.
- API `503`: inspect PostgreSQL health and server logs. Never expose port 5432
  to diagnose remotely.
- Client calls the wrong host: `VITE_API_BASE_URL` is compile-time. Correct the
  GitHub `APP_DOMAIN` variable and publish a new commit-SHA image.
- Disk pressure: inspect `docker system df` and backup retention. Do not delete
  the current/previous images or unverified backups during an incident.
