#!/usr/bin/env node
/*
 * Seed a FRESH Wiki.js NG instance with the demo content used for the README
 * screenshots: a small fictional company workspace with people, groups and
 * page rules, a documentation tree, assets, moderated comment threads,
 * bookmarks and watches.
 *
 * Never run this against a real wiki — it completes the setup wizard and
 * creates users and content. dev/screenshots.sh runs it against a throwaway
 * container.
 *
 * Usage: node dev/screenshots/seed-demo.js <base url> <admin email> <admin password> [timeline.sql]
 * Prints the admin JWT on the last line of stdout. With a timeline file, it also
 * writes SQL that spreads the page activity and comments over the last two weeks
 * (the API always records "now"); dev/screenshots.sh applies it inside the container.
 */
const fs = require('fs')
const path = require('path')

const [BASE, ADMIN_EMAIL, ADMIN_PASS, TIMELINE_FILE] = process.argv.slice(2)
if (!BASE || !ADMIN_EMAIL || !ADMIN_PASS) {
  console.error('Usage: seed-demo.js <base url> <admin email> <admin password> [timeline.sql]')
  process.exit(1)
}
const USER_PASS = 'Demo-Passw0rd!'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const log = msg => console.error(`>> ${msg}`)

async function waitFor (url, pattern) {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(url)
      if (res.ok && (await res.text()).includes(pattern)) {
        return
      }
    } catch (err) {}
    await sleep(1000)
  }
  throw new Error(`${url} did not come up`)
}

async function gql (jwt, query, variables = {}) {
  const res = await fetch(`${BASE}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(jwt && { Authorization: `Bearer ${jwt}` }) },
    body: JSON.stringify({ query, variables })
  })
  const body = await res.json()
  if (body.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(body.errors)}`)
  }
  // -> Mutations report failures in responseResult instead of errors
  const result = JSON.stringify(body.data).match(/"succeeded":false[^}]*"message":"([^"]*)"/)
  if (result) {
    throw new Error(`GraphQL mutation failed: ${result[1]}`)
  }
  return body.data
}

async function login (email, password) {
  try {
    const data = await gql(null, `mutation ($u: String!, $p: String!) {
      authentication { login(username: $u, password: $p, strategy: "local") { jwt responseResult { succeeded message } } }
    }`, { u: email, p: password })
    return data.authentication.login.jwt
  } catch (err) {
    // -> Logins are rate limited (5 per minute): wait as long as the server asks
    const wait = err.message.match(/try again in (\d+) seconds/)
    if (!wait) {
      throw err
    }
    log(`Login rate limit reached, waiting ${wait[1]}s...`)
    await sleep((Number(wait[1]) + 1) * 1000)
    return login(email, password)
  }
}

// -----------------------------------------------
// Demo content: "Swissmakers", a platform engineering team
// (Linux engineering, Go programming and system hardening)
// All visible text is plain ASCII (umlauts allowed), titles without dashes.
// -----------------------------------------------

const ADMIN_PROFILE = { name: 'Lea Brunner', jobTitle: 'Head of Platform Security', location: 'Zürich' }
// New accounts default to America/New_York; the demo team works in Switzerland
const TIMEZONE = 'Europe/Zurich'

const people = [
  { key: 'anna', email: 'anna.keller@example.com', name: 'Anna Keller', jobTitle: 'Linux Engineer', location: 'Bern', group: 'Editors' },
  { key: 'marco', email: 'marco.rossi@example.com', name: 'Marco Rossi', jobTitle: 'Go Developer', location: 'Lugano', group: 'Editors' },
  { key: 'sophie', email: 'sophie.dubois@example.com', name: 'Sophie Dubois', jobTitle: 'Site Reliability Engineer', location: 'Geneva', group: 'Editors' },
  { key: 'jonas', email: 'jonas.meier@example.com', name: 'Jonas Meier', jobTitle: 'Support Engineer', location: 'Basel', group: 'Readers' }
]

// The first entry (home) is created last so its links render as existing pages.
// Keep the order of the next four: the screenshots open page #4 (hardening/baseline),
// which an Editors page rule makes read-only.
const pages = [
  {
    path: 'home',
    author: 'admin',
    title: 'Welcome',
    description: 'Platform engineering knowledge: Linux, Go and system hardening',
    tags: ['welcome'],
    content: `Welcome to the Swissmakers platform wiki. This is where we keep how our Linux fleet is built, how we write and ship Go services and how every host is hardened before it goes live.

## Where to find what

| Area | What you will find |
| --- | --- |
| Linux engineering | [Systemd service units](/linux/systemd), [Apache reverse proxy](/linux/apache), [LVM storage](/linux/storage/lvm), [nftables](/linux/network/nftables) and [rootless Podman](/linux/podman) |
| Go programming | [Project layout](/golang/layout), [error handling](/golang/errors), [table driven tests](/golang/testing), [context and goroutines](/golang/concurrency) and [releases](/golang/releases) |
| System hardening | [CIS baseline](/hardening/baseline), [SSH](/hardening/ssh), [SELinux](/hardening/selinux), [auditd](/hardening/auditd) and [kernel parameters](/hardening/sysctl) |
| Team handbook | [New starter guide](/handbook/onboarding) and [code review guidelines](/handbook/reviews) |
| Operations | [Service catalog](/operations/services), [on call rotation](/operations/oncall) and [incident response](/operations/incidents) |

New here? Start with the [new starter guide](/handbook/onboarding).

## How we write pages

- One topic per page, with a clear **title** and a one line **description**
- Commands are copy and paste ready and tested on RHEL 9
- Every page has an **owner** who reviews it once per quarter
- Link to related pages instead of copying text

> The hardening section is maintained by the security team. Propose changes in the comments or open a merge request in the Ansible repository.
{.is-info}

## Need help?

Ask in the comments below or in the \`#platform\` channel.
`
  },
  {
    path: 'linux/systemd',
    author: 'anna',
    title: 'Systemd Service Units',
    description: 'Run our services as hardened systemd units on RHEL 9',
    tags: ['linux', 'systemd', 'runbook'],
    content: `Every service on our hosts runs as a systemd unit with its own system user, a restricted file system view and automatic restarts. This page shows the unit template we use and how to roll it out.

## Unit template

Place the unit in \`/etc/systemd/system/inventory.service\`:

\`\`\`ini
[Unit]
Description=Inventory API
After=network-online.target
Wants=network-online.target

[Service]
User=inventory
Group=inventory
ExecStart=/usr/local/bin/inventory --config /etc/inventory/config.yml
Restart=on-failure
RestartSec=5s

# Sandboxing
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
ReadWritePaths=/var/lib/inventory
CapabilityBoundingSet=

[Install]
WantedBy=multi-user.target
\`\`\`

## Roll out

\`\`\`bash
useradd --system --no-create-home --shell /sbin/nologin inventory
install -d -o inventory -g inventory /var/lib/inventory
systemctl daemon-reload
systemctl enable --now inventory.service
\`\`\`

Check that the unit is running and look at the last log lines:

\`\`\`plaincommand
systemctl status inventory.service
journalctl -u inventory.service -n 50 --no-pager
\`\`\`

## Sandboxing options

| Option | Effect | Default for our services |
| --- | --- | --- |
| \`NoNewPrivileges\` | Blocks privilege escalation through setuid binaries | yes |
| \`ProtectSystem\` | Mounts \`/usr\`, \`/boot\` and \`/etc\` read only | strict |
| \`ProtectHome\` | Hides \`/home\`, \`/root\` and \`/run/user\` | yes |
| \`PrivateTmp\` | Gives the service its own \`/tmp\` | yes |
| \`CapabilityBoundingSet\` | Removes all Linux capabilities | empty |

Run \`systemd-analyze security inventory.service\` to see the exposure score of a unit. Our target is a score below 3.0.

> Never put secrets into the unit file. Use \`LoadCredential=\` or an environment file readable only by root.
{.is-warning}

> Do not edit units below \`/usr/lib/systemd\`. Package updates overwrite them; use a drop in file in \`/etc/systemd/system/<unit>.d/\` instead.
{.is-danger}

## Overrides

To change a single setting of a packaged unit, create a drop in:

\`\`\`bash
systemctl edit nginx.service
\`\`\`

## Next steps

- Put the service behind the [Apache reverse proxy](/linux/apache)
- Apply the [CIS baseline](/hardening/baseline) to the host
`
  },
  {
    path: 'linux/apache',
    author: 'anna',
    title: 'Apache Reverse Proxy',
    description: 'Publish internal services through Apache httpd with TLS',
    tags: ['linux', 'apache', 'tls'],
    content: `Internal services are never exposed directly. Apache httpd terminates TLS and forwards requests to the service on localhost.

## Virtual host

\`\`\`apache
<VirtualHost *:443>
    ServerName inventory.swissmakers.example
    SSLEngine on
    SSLCertificateFile /etc/pki/tls/certs/inventory.crt
    SSLCertificateKeyFile /etc/pki/tls/private/inventory.key

    ProxyPreserveHost On
    ProxyPass        / http://127.0.0.1:8080/
    ProxyPassReverse / http://127.0.0.1:8080/

    Header always set Strict-Transport-Security "max-age=63072000"
</VirtualHost>
\`\`\`

## SELinux

Allow httpd to open network connections to the backend:

\`\`\`plaincommand
setsebool -P httpd_can_network_connect on
\`\`\`

## Test

\`\`\`bash
apachectl configtest
systemctl reload httpd
curl -I https://inventory.swissmakers.example/healthz
\`\`\`
`
  },
  {
    path: 'hardening/ssh',
    author: 'admin',
    title: 'SSH Hardening',
    description: 'Key only logins, modern ciphers and no root access',
    tags: ['hardening', 'ssh', 'security'],
    content: `All hosts accept SSH logins with keys only. Root cannot log in, and only members of the \`sshusers\` group may connect.

## Configuration

Create \`/etc/ssh/sshd_config.d/10-hardening.conf\`:

\`\`\`plaincommand
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
AllowGroups sshusers
MaxAuthTries 3
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2
\`\`\`

## Crypto policy

RHEL 9 sets ciphers through the system wide crypto policy. We use \`DEFAULT\` with the \`NO-SHA1\` sub policy:

\`\`\`bash
update-crypto-policies --set DEFAULT:NO-SHA1
\`\`\`

## Verify

\`\`\`bash
sshd -t && systemctl reload sshd
ssh -o PreferredAuthentications=password admin@host01   # must be rejected
\`\`\`

> Keep a second session open while you change the SSH configuration, so a mistake cannot lock you out.
{.is-warning}
`
  },
  {
    path: 'hardening/baseline',
    author: 'admin',
    title: 'CIS Baseline for RHEL 9',
    description: 'The hardening profile every host gets before it goes live',
    tags: ['hardening', 'security', 'compliance'],
    content: `Every RHEL 9 host is hardened with the CIS Level 1 Server profile before it receives production traffic. The profile is applied by our Ansible role and verified with OpenSCAP.

## Scan a host

\`\`\`bash
dnf install -y openscap-scanner scap-security-guide
oscap xccdf eval \\
  --profile xccdf_org.ssgproject.content_profile_cis_server_l1 \\
  --report /tmp/cis-report.html \\
  /usr/share/xml/scap/ssg/content/ssg-rhel9-ds.xml
\`\`\`

## Accepted deviations

| Rule | Reason | Approved by |
| --- | --- | --- |
| Separate partition for \`/var/tmp\` | Bind mount of \`/tmp\` instead | Lea Brunner |
| Disable USB storage | Required on the build servers | Lea Brunner |
| Password expiry after 365 days | Logins are key only, see [SSH hardening](/hardening/ssh) | Lea Brunner |

## Related pages

- [SELinux in enforcing mode](/hardening/selinux)
- [Audit logging with auditd](/hardening/auditd)
- [Kernel parameters](/hardening/sysctl)

> Changes to this baseline need a review by the security team.
{.is-info}
`
  },
  {
    path: 'hardening/selinux',
    author: 'admin',
    title: 'SELinux in Enforcing Mode',
    description: 'Keep SELinux enforcing and fix denials the right way',
    tags: ['hardening', 'selinux', 'security'],
    content: `SELinux stays in enforcing mode on every host. A denial is a bug in our setup, not a reason to switch it off.

## Check the mode

\`\`\`plaincommand
getenforce
sestatus
\`\`\`

## Find denials

\`\`\`bash
ausearch -m AVC -ts recent
sealert -a /var/log/audit/audit.log
\`\`\`

## Fix a wrong file context

\`\`\`bash
semanage fcontext -a -t httpd_sys_content_t "/srv/www(/.*)?"
restorecon -Rv /srv/www
\`\`\`

> Never run \`setenforce 0\` on a production host. If you need a quick test, set a single domain to permissive with \`semanage permissive -a <domain>\`.
{.is-danger}
`
  },
  {
    path: 'hardening/auditd',
    author: 'admin',
    title: 'Audit Logging with auditd',
    description: 'Which events we record and where the logs go',
    tags: ['hardening', 'audit', 'security'],
    content: `auditd records privileged commands, changes to accounts and access to sensitive files. The logs are forwarded to the central log server every minute.

## Rules

\`\`\`plaincommand
-w /etc/passwd -p wa -k identity
-w /etc/shadow -p wa -k identity
-w /etc/sudoers -p wa -k privilege
-a always,exit -F arch=b64 -S execve -F euid=0 -k root_commands
\`\`\`

## Search the log

\`\`\`bash
ausearch -k identity --start today
aureport --summary
\`\`\`
`
  },
  {
    path: 'hardening/sysctl',
    author: 'admin',
    title: 'Kernel Parameters',
    description: 'Network and memory settings we set on every host',
    tags: ['hardening', 'kernel', 'security'],
    content: `These kernel parameters are set in \`/etc/sysctl.d/90-hardening.conf\` on every host.

\`\`\`ini
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.rp_filter = 1
net.ipv4.tcp_syncookies = 1
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
kernel.yama.ptrace_scope = 1
fs.suid_dumpable = 0
\`\`\`

Apply them without a reboot:

\`\`\`plaincommand
sysctl --system
\`\`\`
`
  },
  {
    path: 'linux/storage/lvm',
    author: 'anna',
    title: 'LVM and XFS Storage',
    description: 'Create, grow and snapshot logical volumes',
    tags: ['linux', 'storage'],
    content: `Data volumes are LVM logical volumes formatted with XFS. XFS can grow online but never shrink, so start small and extend when needed.

## Create a volume

\`\`\`bash
pvcreate /dev/sdb
vgcreate data /dev/sdb
lvcreate -n inventory -L 20G data
mkfs.xfs /dev/data/inventory
\`\`\`

## Grow it

\`\`\`plaincommand
lvextend -r -L +10G /dev/data/inventory
\`\`\`

The \`-r\` flag grows the file system together with the volume.
`
  },
  {
    path: 'linux/network/nftables',
    author: 'anna',
    title: 'Firewall with nftables',
    description: 'Default deny rules for our hosts',
    tags: ['linux', 'network', 'hardening'],
    content: `Hosts drop all incoming traffic except SSH from the management network and the ports of their own services.

\`\`\`plaincommand
table inet filter {
  chain input {
    type filter hook input priority 0; policy drop;
    ct state established,related accept
    iif lo accept
    ip saddr 10.10.0.0/24 tcp dport 22 accept
    tcp dport { 80, 443 } accept
  }
}
\`\`\`

Load and persist the rules:

\`\`\`bash
nft -f /etc/sysconfig/nftables.conf
systemctl enable --now nftables
\`\`\`
`
  },
  {
    path: 'linux/podman',
    author: 'marco',
    title: 'Rootless Podman Containers',
    description: 'Run containers without root and manage them with Quadlet',
    tags: ['linux', 'containers', 'podman'],
    content: `Containers run rootless under a dedicated user. Quadlet turns a small unit file into a systemd service.

## Quadlet unit

\`~/.config/containers/systemd/inventory.container\`:

\`\`\`ini
[Container]
Image=registry.swissmakers.example/inventory:1.8.2
PublishPort=127.0.0.1:8080:8080
Volume=inventory-data:/data:Z

[Install]
WantedBy=default.target
\`\`\`

## Start it

\`\`\`bash
loginctl enable-linger inventory
systemctl --user daemon-reload
systemctl --user start inventory
\`\`\`
`
  },
  {
    path: 'golang/layout',
    author: 'marco',
    title: 'Go Project Layout',
    description: 'How we structure Go services and libraries',
    tags: ['go', 'conventions'],
    content: `All Go services follow the same layout, so everybody finds their way around a new repository quickly.

\`\`\`plaincommand
inventory/
  cmd/inventory/main.go     entry point, flags and wiring only
  internal/api/             HTTP handlers
  internal/store/           database access
  internal/config/          configuration loading
  go.mod
  Makefile
\`\`\`

## Rules

- Business logic lives in \`internal/\`, never in \`main.go\`
- One package per responsibility, named after what it provides
- No \`util\` or \`common\` packages
- Dependencies are passed in explicitly, no global state

## Tooling

\`\`\`bash
go vet ./...
staticcheck ./...
govulncheck ./...
\`\`\`
`
  },
  {
    path: 'golang/errors',
    author: 'marco',
    title: 'Error Handling in Go',
    description: 'Wrap errors with context and check them with errors.Is',
    tags: ['go', 'conventions'],
    content: `Errors are values. We return them, wrap them with context and decide at the edge of the program how to report them.

## Wrap with context

\`\`\`go
func (s *Store) Item(ctx context.Context, id string) (*Item, error) {
\trow := s.db.QueryRowContext(ctx, "SELECT name, qty FROM items WHERE id = $1", id)
\tvar it Item
\tif err := row.Scan(&it.Name, &it.Qty); err != nil {
\t\treturn nil, fmt.Errorf("load item %s: %w", id, err)
\t}
\treturn &it, nil
}
\`\`\`

## Check the cause

\`\`\`go
item, err := store.Item(ctx, id)
if errors.Is(err, sql.ErrNoRows) {
\thttp.Error(w, "item not found", http.StatusNotFound)
\treturn
}
\`\`\`

## Rules

- Add context that helps the reader of the log, not the name of the function
- Handle an error once: either log it or return it
- Never compare error strings
`
  },
  {
    path: 'golang/testing',
    author: 'marco',
    title: 'Table Driven Tests',
    description: 'Write compact tests that cover many cases',
    tags: ['go', 'testing'],
    content: `Most of our tests are table driven: one slice of cases, one loop, one subtest per case.

\`\`\`go
func TestParseSize(t *testing.T) {
\ttests := []struct {
\t\tin   string
\t\twant int64
\t}{
\t\t{"512", 512},
\t\t{"4K", 4096},
\t\t{"2M", 2 << 20},
\t}
\tfor _, tt := range tests {
\t\tt.Run(tt.in, func(t *testing.T) {
\t\t\tgot, err := ParseSize(tt.in)
\t\t\tif err != nil || got != tt.want {
\t\t\t\tt.Fatalf("ParseSize(%q) = %d, %v; want %d", tt.in, got, err, tt.want)
\t\t\t}
\t\t})
\t}
}
\`\`\`

Run the tests with the race detector in CI:

\`\`\`plaincommand
go test -race -cover ./...
\`\`\`
`
  },
  {
    path: 'golang/concurrency',
    author: 'marco',
    title: 'Context and Goroutines',
    description: 'Cancel work cleanly and never leak goroutines',
    tags: ['go', 'concurrency'],
    content: `Every goroutine we start has a clear owner and stops when its context is cancelled.

\`\`\`go
g, ctx := errgroup.WithContext(ctx)
for _, host := range hosts {
\tg.Go(func() error {
\t\treturn check(ctx, host)
\t})
}
if err := g.Wait(); err != nil {
\treturn fmt.Errorf("health check: %w", err)
}
\`\`\`

## Rules

- Pass \`context.Context\` as the first argument
- Use \`errgroup\` instead of a bare \`sync.WaitGroup\` when errors matter
- Close channels on the sending side only
`
  },
  {
    path: 'golang/releases',
    author: 'marco',
    title: 'Static Binaries and Releases',
    description: 'Build reproducible static binaries for our hosts',
    tags: ['go', 'release'],
    content: `Services are shipped as static binaries. They run on every RHEL 9 host without extra libraries.

\`\`\`bash
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \\
  go build -trimpath -ldflags "-s -w -X main.version=1.8.2" \\
  -o dist/inventory ./cmd/inventory
\`\`\`

The CI pipeline signs the binary and uploads it with a checksum file to the release page.
`
  },
  {
    path: 'handbook/onboarding',
    author: 'sophie',
    title: 'New Starter Guide',
    description: 'Your first week in the platform team',
    tags: ['handbook', 'onboarding'],
    content: `Welcome to the team! This checklist gets you productive in your first week.

## Day one

- [ ] Receive your laptop and YubiKey
- [ ] Enable 2FA for the wiki, Git and the VPN
- [ ] Upload your SSH key, see [SSH hardening](/hardening/ssh)
- [ ] Bookmark the [service catalog](/operations/services)

## First week

- [ ] Build and run the inventory service locally, see [Go project layout](/golang/layout)
- [ ] Deploy a test host with the [CIS baseline](/hardening/baseline)
- [ ] Shadow one on call shift
`
  },
  {
    path: 'handbook/reviews',
    author: 'sophie',
    title: 'Code Review Guidelines',
    description: 'How we review merge requests',
    tags: ['handbook', 'process'],
    content: `Every change is reviewed by at least one other engineer before it is merged.

## As an author

- Keep merge requests small and focused
- Describe why the change is needed, not only what it does
- Make sure CI is green before you ask for a review

## As a reviewer

- Review within one working day
- Ask questions instead of giving orders
- Approve when the change makes the code better, even if it is not perfect
`
  },
  {
    path: 'operations/incidents',
    author: 'sophie',
    title: 'Incident Response',
    description: 'What to do when production breaks',
    tags: ['operations', 'runbook'],
    content: `## Severity levels

| Level | Example | Response time |
| --- | --- | --- |
| SEV1 | Customer facing service down | 15 minutes |
| SEV2 | Degraded performance, workaround exists | 1 hour |
| SEV3 | Internal tool affected | Next working day |

## First steps

1. Acknowledge the alert and post in the incident channel
2. Assign an incident lead
3. Post a status update every 30 minutes.

## After the incident

Write a blameless review within five working days.
`
  },
  {
    path: 'operations/services',
    author: 'admin',
    title: 'Service Catalog',
    description: 'All services we run, with owners and runbooks',
    tags: ['operations'],
    content: `| Service | Owner | Runbook |
| --- | --- | --- |
| Inventory API | Marco Rossi | [Systemd service units](/linux/systemd) |
| Reverse proxy | Anna Keller | [Apache reverse proxy](/linux/apache) |
| Log server | Sophie Dubois | [Audit logging](/hardening/auditd) |
| Wiki | Lea Brunner | This wiki |
`
  },
  {
    path: 'operations/drafts/oncall',
    author: 'sophie',
    title: 'On Call Rotation',
    description: 'Who is on call and how to hand over',
    tags: ['operations', 'runbook'],
    content: `## Rotation

The on call week starts on Monday at 09:00. The rotation is published in the team calendar.

## Handover

- Open incidents and their current state
- Planned maintenance for the coming week
- Anything unusual in the monitoring

## Escalation

If you cannot resolve a SEV1 within 30 minutes, call the platform lead.
`
  }
]

// -> Timeline for the screenshots: working hours on weekdays, newest first
function workdayTimestamps (count, start = new Date()) {
  const stamps = []
  let t = new Date(start.getTime() - 25 * 60 * 1000)
  for (let k = 0; k < count; k++) {
    stamps.push(t.toISOString())
    t = new Date(t.getTime() - (2 + (k * 7) % 5) * 60 * 60 * 1000 - ((k * 23) % 50) * 60 * 1000)
    // Outside 07:00–17:00 UTC or on a weekend: continue at the end of the previous working day
    while (t.getUTCHours() < 7 || t.getUTCHours() >= 17 || [0, 6].includes(t.getUTCDay())) {
      t = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - 1, 16, 10 + (k * 13) % 45))
    }
  }
  return stamps
}

// -> SQL that assigns the k-th newest row of a table the k-th timestamp
function timelineSql (table, columns, stamps) {
  const values = stamps.map((ts, k) => `(${k}, '${ts}')`).join(', ')
  const set = columns.map(c => `${c} = (SELECT ts FROM t WHERE t.k = (SELECT COUNT(*) FROM ${table} b WHERE b.id > ${table}.id))`).join(', ')
  return `WITH t(k, ts) AS (VALUES ${values}) UPDATE ${table} SET ${set};`
}

async function main () {
  log(`Seeding ${BASE}...`)
  await waitFor(`${BASE}/`, 'Wiki.js NG')

  // -> Setup wizard
  const setup = await fetch(`${BASE}/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminEmail: ADMIN_EMAIL, adminPassword: ADMIN_PASS, adminPasswordConfirm: ADMIN_PASS, siteUrl: BASE })
  }).then(res => res.json())
  if (!setup.ok) {
    throw new Error(`Setup failed: ${JSON.stringify(setup)}`)
  }
  await sleep(3000)
  await waitFor(`${BASE}/healthz`, 'ok')
  let admin = await login(ADMIN_EMAIL, ADMIN_PASS)
  log('Setup completed')

  await gql(admin, `mutation { site { updateConfig(
    title: "Swissmakers Wiki", company: "Swissmakers", contentLicense: "alr",
    description: "Platform engineering knowledge: Linux, Go and system hardening"
  ) { responseResult { succeeded message } } } }`)

  // -> The administrator is a person, not "Administrator" (shown as author everywhere)
  const userList = async () => (await gql(admin, '{ users { list { id email } } }')).users.list
  const adminId = (await userList()).find(u => u.email === ADMIN_EMAIL).id
  await gql(admin, `mutation ($id: Int!, $n: String!, $j: String!, $l: String!, $tz: String!) {
    users { update(id: $id, name: $n, jobTitle: $j, location: $l, timezone: $tz) { responseResult { succeeded message } } }
  }`, { id: adminId, n: ADMIN_PROFILE.name, j: ADMIN_PROFILE.jobTitle, l: ADMIN_PROFILE.location, tz: TIMEZONE })
  admin = await login(ADMIN_EMAIL, ADMIN_PASS)

  // -> Editors may edit everything except the hardening baseline (security team only), readers may comment
  const group = async (name, permissions, rules) => {
    const id = (await gql(admin, 'mutation ($n: String!) { groups { create(name: $n) { responseResult { succeeded message } group { id } } } }', { n: name })).groups.create.group.id
    await gql(admin, `mutation ($id: Int!, $n: String!, $perms: [String]!, $rules: [PageRuleInput]!) {
      groups { update(id: $id, name: $n, redirectOnLogin: "/", permissions: $perms, pageRules: $rules) { responseResult { succeeded message } } }
    }`, { id, n: name, perms: permissions, rules })
    return id
  }
  const readPerms = ['read:pages', 'read:assets', 'read:comments', 'write:comments']
  const editPerms = [...readPerms, 'read:source', 'read:history', 'write:pages', 'write:assets']
  const groups = {
    Editors: await group('Editors', editPerms, [
      { id: 'editors-all', deny: false, match: 'START', roles: editPerms, path: '', locales: [] },
      { id: 'editors-hardening-ro', deny: true, match: 'START', roles: ['write:pages'], path: 'hardening', locales: [] }
    ]),
    Readers: await group('Readers', readPerms, [
      { id: 'readers-all', deny: false, match: 'START', roles: readPerms, path: '', locales: [] }
    ])
  }
  const jwt = { admin }
  for (const usr of people) {
    await gql(admin, `mutation ($e: String!, $n: String!, $g: [Int]!, $p: String!) {
      users { create(email: $e, name: $n, passwordRaw: $p, providerKey: "local", groups: $g, mustChangePassword: false, sendWelcomeEmail: false) { responseResult { succeeded message } } }
    }`, { e: usr.email, n: usr.name, g: [groups[usr.group]], p: USER_PASS })
  }
  const ids = await userList()
  for (const usr of people) {
    await gql(admin, `mutation ($id: Int!, $j: String!, $l: String!, $tz: String!) {
      users { update(id: $id, jobTitle: $j, location: $l, timezone: $tz) { responseResult { succeeded message } } }
    }`, { id: ids.find(u => u.email === usr.email).id, j: usr.jobTitle, l: usr.location, tz: TIMEZONE })
    jwt[usr.key] = await login(usr.email, USER_PASS)
  }
  log(`${people.length + 1} people and 2 groups created`)

  // -> Pages, each created by its owner
  const pageIds = {}
  for (const pg of [...pages.slice(1), pages[0]]) {
    await gql(jwt[pg.author], `mutation ($c: String!, $d: String!, $p: String!, $t: String!, $tags: [String]!) {
      pages { create(content: $c, description: $d, editor: "markdown", isPublished: true, isPrivate: false, locale: "en", path: $p, tags: $tags, title: $t) { responseResult { succeeded message } } }
    }`, { c: pg.content, d: pg.description, p: pg.path, t: pg.title, tags: pg.tags })
    pageIds[pg.path] = (await gql(admin, 'query ($p: String!) { pages { singleByPath(path: $p, locale: "en") { id } } }', { p: pg.path })).pages.singleByPath.id
  }
  const page = p => pages.find(pg => pg.path === p)

  // -> Later edits, a move and a second round of reviews, so the recent changes look lived-in
  const edit = (who, p, changes) => gql(jwt[who], `mutation ($id: Int!, $c: String, $d: String, $t: String, $tags: [String]) {
    pages { update(id: $id, content: $c, description: $d, title: $t, tags: $tags) { responseResult { succeeded message } } }
  }`, { id: pageIds[p], ...changes })
  await gql(admin, 'mutation ($id: Int!) { pages { move(id: $id, destinationPath: "operations/oncall", destinationLocale: "en") { responseResult { succeeded message } } } }', {
    id: pageIds['operations/drafts/oncall']
  })
  const errorsPage = page('golang/errors').content
  await edit('anna', 'golang/errors', { c: errorsPage.replace('## Rules', '## Sentinel errors\n\nExport sentinel errors only when callers need to react to them:\n\n```go\nvar ErrNotFound = errors.New("not found")\n```\n\n## Rules') })
  await edit('marco', 'golang/errors', { c: errorsPage.replace('## Rules', '## Sentinel errors\n\nExport sentinel errors only when callers need to react to them:\n\n```go\nvar ErrNotFound = errors.New("not found")\n```\n\n## Logging\n\nLog errors once, at the edge of the program, with `slog` and the request ID:\n\n```go\nslog.ErrorContext(ctx, "load item", "id", id, "err", err)\n```\n\n## Rules').replace('Never compare error strings', 'Never compare error strings, use `errors.Is` and `errors.As`') })
  await edit('admin', 'golang/errors', { d: 'Wrap errors with context, check them with errors.Is and log them once' })
  await edit('marco', 'linux/systemd', { c: page('linux/systemd').content.replace('## Overrides', '## Resource limits\n\nCap memory and CPU per service with `MemoryMax=` and `CPUQuota=`, so a runaway process cannot starve the host.\n\n## Overrides') })
  await edit('sophie', 'handbook/onboarding', { c: page('handbook/onboarding').content.replace('- [ ] Shadow one on call shift', '- [ ] Book a coffee with your onboarding buddy\n- [ ] Shadow one on call shift') })
  await edit('admin', 'linux/apache', { d: 'Publish internal services through Apache httpd with TLS and HSTS' })
  await edit('sophie', 'operations/incidents', { c: page('operations/incidents').content.replace('every 30 minutes.', 'every 30 minutes in `#incidents`.') })
  log(`${pages.length} pages created and edited`)

  // -> A populated sidebar makes the demo useful as a small company workspace
  const navItems = [
    { kind: 'link', label: 'Wiki home', icon: 'mdi-home-outline', target: '/home' },
    { kind: 'header', label: 'Engineering' },
    { kind: 'link', label: 'Linux engineering', icon: 'mdi-linux', target: '/linux' },
    { kind: 'link', label: 'Go programming', icon: 'mdi-language-go', target: '/golang' },
    { kind: 'link', label: 'System hardening', icon: 'mdi-shield-lock-outline', target: '/hardening' },
    { kind: 'header', label: 'Our team' },
    { kind: 'link', label: 'Team handbook', icon: 'mdi-account-group-outline', target: '/handbook' },
    { kind: 'link', label: 'Operations', icon: 'mdi-lifebuoy', target: '/operations' },
    { kind: 'link', label: 'Recent changes', icon: 'mdi-history', target: '/r' }
  ].map((item, index) => ({ id: `demo-nav-${index}`, targetType: 'external', visibilityMode: 'all', visibilityGroups: [], ...item }))
  await gql(admin, `mutation ($tree: [NavigationTreeInput]!) {
    navigation { updateTree(tree: $tree) { responseResult { succeeded message } } }
  }`, { tree: [{ locale: 'en', items: navItems }] })
  log('Workspace navigation created')

  // -> Assets
  const folderMutation = 'mutation ($slug: String!) { assets { createFolder(parentFolderId: 0, slug: $slug) { responseResult { succeeded message } } } }'
  for (const slug of ['diagrams', 'hardening', 'runbooks']) {
    await gql(admin, folderMutation, { slug })
  }
  const folders = (await gql(admin, '{ assets { folders(parentFolderId: 0) { id slug } } }')).assets.folders
  const folder = slug => folders.find(f => f.slug === slug).id
  const diagram = fs.readFileSync(path.join(__dirname, 'architecture.svg'))
  const text = lines => Buffer.from(lines.join('\n') + '\n')
  const uploads = [
    { name: 'architecture-diagram.svg', folder: 0, data: diagram, type: 'image/svg+xml' },
    { name: 'office-background.jpg', folder: 0, data: fs.readFileSync(path.join(__dirname, '../../client/static/img/login-office.jpg')), type: 'image/jpeg' },
    { name: 'host-checklist.txt', folder: 0, data: text(['New host checklist', '', '1. Install RHEL 9 from the golden image', '2. Apply the CIS baseline role', '3. Run the OpenSCAP scan', '4. Register the host in the service catalog', '5. Enable log forwarding']), type: 'text/plain' },
    { name: 'release-notes.txt', folder: 0, data: text(['Platform release notes', '', 'Updated systemd unit template, Go error handling guide and SSH hardening.']), type: 'text/plain' },
    { name: 'architecture-overview.svg', folder: folder('diagrams'), data: diagram, type: 'image/svg+xml' },
    { name: 'cis-deviations.txt', folder: folder('hardening'), data: text(['Accepted CIS deviations', '', '- Bind mount for /var/tmp', '- USB storage on build servers', '- No password expiry for key only logins']), type: 'text/plain' },
    { name: 'incident-timeline-template.txt', folder: folder('runbooks'), data: text(['Incident timeline', '', 'Time | Action | Who', '---- | ------ | ---']), type: 'text/plain' }
  ]
  for (const up of uploads) {
    const form = new FormData()
    form.append('mediaUpload', JSON.stringify({ folderId: up.folder }))
    form.append('mediaUpload', new Blob([up.data], { type: up.type }), up.name)
    const res = await fetch(`${BASE}/u`, { method: 'POST', headers: { Authorization: `Bearer ${admin}` }, body: form })
    if (!res.ok) {
      throw new Error(`Upload of ${up.name} failed: ${res.status} ${await res.text()}`)
    }
  }
  log(`${uploads.length} assets uploaded`)

  // -> Mail pointing at a closed local port: enables the watch UI, never delivers anything
  await gql(admin, `mutation { mail { updateConfig(senderName: "Swissmakers Wiki", senderEmail: "wiki@example.com", host: "127.0.0.1", port: 2525, name: "",
    secure: false, verifySSL: false, user: "", pass: "", useDKIM: false, dkimDomainName: "", dkimKeySelector: "", dkimPrivateKey: "") { responseResult { succeeded message } } } }`)

  // -> Comments: moderation for everyone, so a pending reply shows up
  await gql(admin, 'mutation ($cfg: [KeyValuePairInput]) { comments { updateProviders(providers: [{ isEnabled: true, key: "default", config: $cfg }]) { responseResult { succeeded message } } } }', {
    cfg: [
      { key: 'akismet', value: JSON.stringify({ v: '' }) },
      { key: 'minDelay', value: JSON.stringify({ v: 0 }) },
      { key: 'moderation', value: JSON.stringify({ v: 'all' }) }
    ]
  })
  const comment = async (who, content, replyTo) => {
    const data = await gql(jwt[who], 'mutation ($p: Int!, $c: String!, $r: Int) { comments { create(pageId: $p, content: $c, replyTo: $r) { responseResult { succeeded message } id isPending } } }', {
      p: pageIds.home, c: content, r: replyTo
    })
    // -> comments.create is rate limited to one call per 15 seconds
    await sleep(16000)
    return data.comments.create
  }
  const approve = id => gql(admin, 'mutation ($id: Int!) { comments { approve(id: $id) { responseResult { succeeded message } } } }', { id })
  const question = await comment('jonas', 'Does the CIS baseline also apply to the build servers, or only to the production hosts?')
  await approve(question.id)
  await comment('admin', 'It applies to every RHEL 9 host. The build servers get the same profile, only USB storage stays enabled there. The deviations are listed on the baseline page.', question.id)
  await comment('anna', 'The Ansible role runs every night, so drift on the build servers is fixed automatically.', question.id)
  const announcement = await comment('marco', 'Heads up: Go 1.25 is now the default toolchain in CI. Please run go mod tidy in your services this week.')
  await approve(announcement.id)
  log('Comments created')

  // -> Bookmarks and watches of the administrator
  for (const p of ['home', 'linux/systemd', 'hardening/baseline', 'golang/errors', 'operations/incidents']) {
    await gql(admin, 'mutation ($id: Int!) { bookmarks { toggle(pageId: $id) { responseResult { succeeded message } } } }', { id: pageIds[p] })
  }
  await gql(admin, 'mutation ($id: Int!) { watches { watchPage(pageId: $id) { responseResult { succeeded message } } } }', { id: pageIds['linux/systemd'] })
  await gql(admin, 'mutation { watches { watchPath(locale: "en", path: "hardening") { responseResult { succeeded message } } } }')
  log('Bookmarks and watches created')

  if (TIMELINE_FILE) {
    const activity = workdayTimestamps(80)
    const sql = [
      timelineSql('pageActivity', ['createdAt'], activity),
      // Page dates follow their activity; versions are dated at the page's creation
      `UPDATE pages SET createdAt = (SELECT MIN(a.createdAt) FROM pageActivity a WHERE a.pageId = pages.id),
        updatedAt = (SELECT MAX(a.createdAt) FROM pageActivity a WHERE a.pageId = pages.id)
        WHERE EXISTS (SELECT 1 FROM pageActivity a WHERE a.pageId = pages.id);`,
      // The n-th version of a page is the state its n-th activity created; it was replaced by the next one
      `UPDATE pageHistory SET
        versionDate = COALESCE((SELECT a.createdAt FROM pageActivity a WHERE a.pageId = pageHistory.pageId
          AND (SELECT COUNT(*) FROM pageActivity a2 WHERE a2.pageId = a.pageId AND a2.createdAt < a.createdAt) = (SELECT COUNT(*) FROM pageHistory h2 WHERE h2.pageId = pageHistory.pageId AND h2.id < pageHistory.id)), versionDate),
        createdAt = COALESCE((SELECT a.createdAt FROM pageActivity a WHERE a.pageId = pageHistory.pageId
          AND (SELECT COUNT(*) FROM pageActivity a2 WHERE a2.pageId = a.pageId AND a2.createdAt < a.createdAt) = (SELECT COUNT(*) FROM pageHistory h2 WHERE h2.pageId = pageHistory.pageId AND h2.id <= pageHistory.id)), createdAt)
        WHERE EXISTS (SELECT 1 FROM pageActivity a WHERE a.pageId = pageHistory.pageId);`,
      // Assets were uploaded over the previous working days
      timelineSql('assets', ['createdAt', 'updatedAt'], workdayTimestamps(20, new Date(Date.now() - 24 * 3600 * 1000))),
      // Discussion over the last two days: replies after their question
      timelineSql('comments', ['createdAt', 'updatedAt'], [3, 19, 22, 26, 30].map(h => new Date(Date.now() - h * 3600 * 1000).toISOString()))
    ]
    fs.writeFileSync(TIMELINE_FILE, sql.join('\n') + '\n')
    log(`Timeline written to ${TIMELINE_FILE}`)
  }

  console.log(admin)
}

main().catch(err => {
  console.error(`!! ${err.message}`)
  process.exit(1)
})
