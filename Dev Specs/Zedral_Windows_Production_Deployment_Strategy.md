# Zedral Windows Server Production Deployment Strategy

**Application:** Zedral M1 (A-59 line, Goodluck India Limited, Sikandrabad Unit 2)
**Deployment class:** On premises, single Windows Server, industrial / plant floor
**Audience:** Zedral engineering (backend, integration, frontend, DevOps) and the client IT / ERP team
**Prepared:** 26 September 2026
**Priorities, in order:** Reliability, Security, Recoverability, Observability, Maintainability, Performance, Simplicity
**Basis:** The real Zedral codebase (Node plus Express, PostgreSQL, SuperTokens, React / Vite / Capacitor PWA, Manifold to Dynamics 365 Business Central), the A-59 technical audit, and the M1 ERP integration plan. Where a fact is not established it is marked TBD and never invented.

---

## 0. Known facts, assumptions, and open items

This section fixes what is known so the rest of the document does not assume. Anything not confirmed is TBD, and the decisions that hang on each TBD are listed in Section 30.

### 0.1 Confirmed from the codebase and project record

| Item | Value | Source |
|---|---|---|
| Backend runtime | Node.js, Express 4, `pg` (node-postgres), self hosted SuperTokens for sessions, ExcelJS for report rendering | A-59 audit, migration plan |
| Backend language | JavaScript at runtime (TypeScript in source, Babel compiled; a TS to JS migration is in progress). Deploys as plain Node. | Migration plan |
| Database | PostgreSQL, schemas `master` / `txn` / `plc` / `erp` / `security` / `ops`, multi tenant with row level security | A-59 audit |
| Query layer | `pg` pool with a per statement tenant GUC today; Kysely in the wider platform monorepo | Audit, migration plan |
| Frontend | React 18, Vite 6, React Router 7, TanStack Query, a hand written service worker plus IndexedDB outbox | A-59 audit |
| Mobile | Capacitor Android wrapper of the same web app; operator tablets on the plant floor | Audit, migration plan |
| Offline capture | Present and load bearing (IndexedDB outbox, idempotency keys, flush on reconnect). Offline is a requirement, not an option. | Audit F12 |
| ERP | Microsoft Dynamics 365 Business Central, integrated through the Manifold connector, read first with staged write back | ERP integration plan |
| ERP contact | Suraj Srivastava, Goodluck IT / ERP (suraj.srivastava@goodluckindia.com) | Project record |
| Migrations | node-pg-migrate, forward migrations as `.js` files | Migration plan |
| Search (platform) | Elasticsearch appears in the wider platform for traceability search | Migration plan |
| Client posture | Goodluck wants the data lake on premises by default; ERP stays system of record | Project record |

### 0.2 Target server (given)

| Resource | Value |
|---|---|
| OS | Windows Server (exact version TBD) |
| CPU | Intel Xeon E5-2630 v3, 2 cores allocated, 2.4 GHz |
| RAM | 16 GB |
| Free storage | Approximately 126 GB |

Two allocated cores is the single hardest constraint in this whole design. Every recommendation below is chosen to fit two cores first and to add capability second.

### 0.3 Open items (TBD, must be closed with the client)

Windows Server version and edition; number of tablets on A-59 (HSL ran 16 operator stations, Goodluck A-59 count is TBD); number of concurrent web users; whether the tablets and web users are on the plant LAN or reach the server across the internet; whether the server has outbound internet at all; whether Dynamics 365 Business Central is on premises or cloud, and its auth method; the MDM platform; expected data volume and retention window; expected API request rate; whether Elasticsearch is required for the single plant M1 scope or can be deferred.

---

## 1. Application and traffic model

Two clients, one backend, one database. The tablet APK and the web frontend both speak HTTPS to the backend API, and only the backend speaks to the database and to the ERP. Nothing else reaches either.

```
Tablet APK  ── HTTPS ──►  Backend / API  ──►  PostgreSQL
Web client  ── HTTPS ──►  Backend / API  ──►  PostgreSQL
                          Backend / API  ──►  Dynamics 365 Business Central (Manifold)
```

Hard rules that shape everything downstream:

The APK never connects to the database. It never holds a database credential, an ERP credential, or any service secret. It talks to the backend only.
The database port is never reachable from any client network. It is bound to loopback on the server.
The ERP is reached only by the backend, over a controlled outbound path, using a dedicated service credential.

---

## 2. Windows deployment approach: native, not Docker Desktop, not WSL2

Three approaches were considered against a two core production Windows Server.

### Option A. Native Windows deployment (recommended)

Each component runs as a first class Windows Service or a native Windows role: PostgreSQL from the EDB Windows installer, the Node backend wrapped as a Windows Service, SuperTokens core wrapped as a Windows Service, and IIS as the web server and reverse proxy. This is the recommendation.

Why it wins on this box: no container runtime tax, no Linux virtual machine sitting under the workload, clean integration with the Service Control Manager, the Windows Event Log, Task Scheduler, the Windows certificate store, and Windows Update. Auto start on boot, ordered service dependencies, and automatic restart on crash all come from the platform itself. On two cores this matters, because there is no spare capacity to spend on an abstraction layer that buys nothing here.

### Option B. Docker Desktop or a Windows container runtime (not recommended for this server)

Docker Desktop is a developer workstation product. It runs a Linux virtual machine through WSL2, ships a GUI, is licensed for individual and small business use rather than as production server software, and is not intended to host production services on a server. Running it on a production Windows Server is the wrong tool, and it is called out here so the client is not surprised later.

The production correct way to run Linux containers on Windows Server is Docker Engine or a container runtime over a Linux virtual machine (WSL2 or Hyper-V). Zedral's images (Node, PostgreSQL, SuperTokens) are Linux images, so they cannot run as native Windows containers. That means a full Linux virtual machine underneath, which on two cores and 16 GB competes directly with the workload it is meant to host. The benefit of containers (reproducible images, isolation) is real but does not justify the memory and CPU tax on a single small box hosting a single plant.

Verdict: do not use Docker Desktop in production. Do not containerize the whole stack on this server. If a container is ever wanted for one component, scope it narrowly and only after native install is proven impractical, which it is not here.

### Option C. Windows Server plus WSL2 for hosting (not recommended)

WSL2 is excellent for development and for the occasional Linux build tool. It is not a production hosting model: services inside WSL2 are not Windows Services, do not auto start cleanly with the machine, do not report to the Service Control Manager or the Event Log, and add a Linux virtual machine memory cost. Do not host production services in WSL2.

### What native deployment means, component by component

| Concern | Native Windows choice | Notes |
|---|---|---|
| Process and service management | Each backing process runs as a Windows Service via a service wrapper (WinSW preferred, NSSM acceptable). SCM handles start order, restart on failure, and boot start. | PM2 as a Windows service is less reliable than WinSW / NSSM and is not recommended here. |
| Web server and reverse proxy | IIS with Application Request Routing and URL Rewrite | See Section 8. |
| TLS | Terminated at IIS using a certificate in the Windows certificate store; HTTP.sys kernel mode TLS; TLS 1.2 and 1.3 only | Section 8, Section 24. |
| Firewall | Windows Defender Firewall with Advanced Security, default deny inbound | Section 7. |
| Scheduled work | Windows Task Scheduler runs the PowerShell jobs (backup, log cleanup, disk and certificate checks, health probes) | Section 26. |
| Automation | PowerShell 5.1 or PowerShell 7 for every repeatable operation | Section 26. |
| Containers | Not used for hosting on this server | Option B rationale above. |

One honest note on SuperTokens core. It is a Java service and is most commonly distributed as a container image. It also ships as a runnable artifact that can run on a JRE, so it can be wrapped as a Windows Service with WinSW. That keeps the native model intact. If the client's platform team strongly prefers a container for this one JVM component, that is the only place a single narrow container could be justified, and even then a native JRE service is simpler on two cores. Which path is used is a small decision, recorded as TBD, that does not change the rest of the architecture.

---

## 3. Recommended Windows stack

| Layer | Recommendation | Why |
|---|---|---|
| Web server and reverse proxy | IIS with ARR and URL Rewrite | Native, service integrated, HTTP.sys TLS, well supported on Windows. |
| Static frontend hosting | IIS serves the built React client (`client/dist`) as the site root | No Node process needed to serve static assets. |
| Backend hosting | Node.js LTS as a Windows Service (WinSW), bound to loopback | Fail closed to the internet, front only through IIS. |
| Session and auth service | SuperTokens core as a Windows Service (JRE), bound to loopback | Already the app's auth core; keep it, harden it. |
| Database | PostgreSQL 16 from the EDB Windows installer, native service | Confirmed database; native install avoids the container tax. |
| Connection pooling | Application level pooling in `pg`, tuned; no PgBouncer for a single backend | PgBouncer on Windows is weakly supported and unnecessary at this scale. |
| Containerization | None for hosting | Section 2. |
| Monitoring | windows_exporter plus postgres_exporter on box; Prometheus and Grafana off box or Grafana Cloud; PowerShell watchdog tasks as a floor | Keeps the two core box free while still observable. |
| Logging | Structured JSON from the backend (pino), IIS W3C logs, PostgreSQL logs, Windows Event Log, DB audit trail | Section 17. |
| Backup | pg_dump nightly plus WAL archiving for point in time recovery, copied off server | Section 19. |
| CI/CD | GitHub Actions for build, test, and security on GitHub hosted runners; deploy to the server through a self hosted deploy runner or a pull based agent | Section 12, Section 13. |
| Secrets | Service account scoped environment set on the service, backed by DPAPI encrypted files or Windows Credential Manager; a vault if the client provides one | Section 24. |
| Process management | Windows Service Control Manager via WinSW / NSSM | Section 2. |

Runtimes to install on the server: Node.js LTS (currently the 20.x or 22.x line, pinned to one version), a supported JRE for SuperTokens core (and for Elasticsearch only if it is kept), PostgreSQL 16, the IIS role with ARR and URL Rewrite, and PowerShell 7 alongside the built in 5.1.

---

## 4. Server resource allocation

The plan reserves headroom on purpose. It never allocates all of RAM and never assumes both cores are free at once.

### 4.1 Memory budget (16 GB total)

| Component | Allocation | Notes |
|---|---|---|
| Windows Server plus pagefile working set | 3.0 GB | OS, Defender, agents. |
| PostgreSQL | 4.0 GB | `shared_buffers` around 2 GB, `effective_cache_size` around 8 GB (a hint, not a reservation), `work_mem` modest to avoid multiplication under concurrency. |
| Node backend | 1.0 GB | Single instance, one primary plus at most one cluster worker. Cap the V8 old space explicitly. |
| SuperTokens core (JVM) | 1.0 GB | Heap capped near 512 MB. |
| IIS and HTTP.sys | 0.5 GB | Static serving plus reverse proxy. |
| Monitoring and logging agents | 0.5 GB | windows_exporter and postgres_exporter are small Go binaries; keep Prometheus and Grafana off box. |
| Backup and report generation headroom | 1.0 GB | ExcelJS report rendering and pg_dump are bursty; give them room. |
| Reserved and free | 5.0 GB | Deliberate headroom for spikes, OS cache, and safety. |

If Elasticsearch is required on this box, it takes roughly 2 GB of heap plus off heap memory and would consume most of the reserved headroom, leaving the server fragile. The recommendation is to not run Elasticsearch on this server for a single plant M1, and to use PostgreSQL full text and trigram search for traceability lookups instead. Elasticsearch, if genuinely needed later, belongs on a separate host. This is a decision to confirm with the team (Section 30).

### 4.2 CPU budget (2 cores)

Two cores is where this deployment lives or dies. All of PostgreSQL, Node, the SuperTokens JVM, and IIS share two cores. The controls that keep it healthy:

Run one Node instance (primary plus at most one worker), not a per core cluster. Limit PostgreSQL parallelism (`max_parallel_workers_per_gather` low, `max_worker_processes` bounded). Schedule backups, log cleanup, and any bulk ERP reconciliation outside plant production hours. Treat report generation (ExcelJS) as CPU heavy and, where possible, queue and serialize large exports rather than allowing many at once. Keep the metrics stack off box so scraping and dashboards do not steal cycles.

### 4.3 Likely bottlenecks, ranked

1. CPU contention under concurrency. The realistic worst case is many tablets flushing offline queues at shift change, plus a report export, plus a scheduled ERP sync, plus overlapping backup. Mitigate with off peak scheduling, export serialization, and bounded parallelism.
2. Disk I/O. OS, PostgreSQL data, WAL, logs, and backups on one volume contend. Mitigate by placing PostgreSQL data and WAL on a separate volume if the disk layout allows (TBD), and by never keeping the only backup copy on the same disk.
3. Memory pressure if Elasticsearch is added. Mitigate by keeping it off this box.
4. Single point of failure. One server means one failure domain. Mitigate with disciplined backups, off server copies, and a documented rebuild runbook; a warm standby is the future upgrade path (Section 19).

---

## 5. Database architecture (PostgreSQL)

Confirmed: PostgreSQL. Co locating it with the backend on the same server removes most of the per statement latency the audit flagged (finding F15), because those round trips are now local rather than crossing to serverless Neon. The transactional integrity work the audit called for (a `withTransaction` helper wrapping multi step writes, finding F6) still stands and must land before real data capture.

### 5.1 Install and layout

Install PostgreSQL 16 from the EDB Windows installer as a native Windows service running under a dedicated low privilege service account (not `postgres` superuser used by the app). Place the data directory on the largest, fastest volume available, and if a second volume exists, put WAL there.

### 5.2 Database, roles, and permissions

Create one application database and a strict role separation. The application connects as an unprivileged role, never as a superuser. This directly closes the audit's carry over item to run as `m1_app` rather than a superuser.

```sql
-- run as the postgres superuser during provisioning only
CREATE DATABASE zedral_prod;

-- migration/DDL role (used only by the deploy step)
CREATE ROLE zedral_migrator LOGIN PASSWORD '<<set at provisioning, stored in the vault>>';

-- application runtime role (least privilege, no DDL, no superuser)
CREATE ROLE zedral_app LOGIN PASSWORD '<<set at provisioning, stored in the vault>>';

\c zedral_prod
-- schemas owned by the migrator, used by the app
GRANT CONNECT ON DATABASE zedral_prod TO zedral_app;
GRANT USAGE ON SCHEMA master, txn, erp, security, ops, plc TO zedral_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA master, txn, erp, security, ops TO zedral_app;
-- no DELETE by default on transactional/audit tables; grant narrowly only where the app needs it
ALTER DEFAULT PRIVILEGES IN SCHEMA txn GRANT SELECT, INSERT, UPDATE ON TABLES TO zedral_app;
```

Row level security stays enabled with `FORCE ROW LEVEL SECURITY` on tenant scoped tables, and the tenant is set through the session GUC as today. The audit noted RLS is uneven across newer feature tables (finding F29); for a single tenant plant deployment the impact is limited, but the coverage gap should be closed before any multi tenant use.

### 5.3 Connection configuration and pooling

The backend uses the `pg` pool. Set the pool `max` conservatively so that the pool size across the one backend instance stays well under PostgreSQL `max_connections`.

```
# postgresql.conf (illustrative, tune against real load)
listen_addresses = 'localhost'      # never a client reachable interface
port = 5432
max_connections = 100               # app pool sits well under this
shared_buffers = 2GB
effective_cache_size = 8GB
work_mem = 16MB
maintenance_work_mem = 256MB
max_parallel_workers_per_gather = 1
wal_level = replica                 # enables WAL archiving / PITR
archive_mode = on
archive_command = 'powershell -File C:\Zedral\scripts\archive_wal.ps1 "%p" "%f"'
log_min_duration_statement = 1000   # log slow queries over 1s
log_line_prefix = '%m [%p] %u@%d '
```

Do not add PgBouncer. With a single backend instance the application pool is sufficient, and a Windows PgBouncer adds a weakly supported moving part for no gain. Revisit only if a second backend instance is ever introduced.

### 5.4 pg_hba.conf (host based access)

Only local and loopback connections. No client network is allowed to reach PostgreSQL.

```
# TYPE  DATABASE      USER              ADDRESS         METHOD
local   all           all                               scram-sha-256
host    zedral_prod   zedral_app        127.0.0.1/32    scram-sha-256
host    zedral_prod   zedral_migrator   127.0.0.1/32    scram-sha-256
# no non-loopback host lines
```

### 5.5 Migrations

node-pg-migrate runs as a gated deploy step under the `zedral_migrator` role, always preceded by a backup (Section 14). Migrations are forward only in practice: some are not safely reversible, so the true rollback for a bad migration is restore from the pre migration backup, not a down migration.

### 5.6 Indexing

Index the genealogy and query hot paths that the audit identified as N plus 1 heavy (the run list and enrich paths, findings F16). Index foreign keys, the coil plus work order genealogy join columns (`work_order_no`, `coil_tag`, `lot_tag`), `tenant_id` on RLS tables, status and date columns used by the operator queues and dashboards, and the ERP watermark and writeback job lookup columns. Verify with `EXPLAIN (ANALYZE, BUFFERS)` against representative queries after seeding realistic volume.

### 5.7 Database monitoring

Track database size and growth, active and idle connections against `max_connections`, slow queries (`log_min_duration_statement` and `pg_stat_statements`), lock waits and blocked queries, cache hit ratio, replication or WAL archive lag, and last successful backup and last successful restore test. postgres_exporter surfaces these to the metrics stack; a PowerShell watchdog checks last backup age as a floor (Section 15).

### 5.8 Restore

Restore is tested, not assumed. A weekly automated job restores the latest backup into a scratch database and runs a row count and integrity check (Section 19). An untested backup is not a backup.

Network rule for this section: the flow is Backend to PostgreSQL, never Internet to PostgreSQL. The database listens on loopback only and no firewall rule exposes 5432.

---

## 6. (folded into Section 5)

Database design is consolidated in Section 5 above so the database story reads as one piece. The core rule bears repeating on its own: PostgreSQL binds to loopback, the app connects as an unprivileged role, and no client network path to 5432 exists.

---

## 7. Windows Defender Firewall configuration

Default deny inbound. Allow only what is listed. The posture depends on network topology (Section 30): if tablets and web users are on the plant LAN, nothing needs to be internet exposed and the strongest posture is LAN only. Internet exposure is used only if the client requires off site access, and then only for 443.

### 7.1 Inbound rules

| Rule | Port | Scope | Purpose |
|---|---|---|---|
| HTTPS in | 443/TCP | Plant LAN (preferred) or public only if required | The one client facing entry point (web and tablets). |
| HTTP in | 80/TCP | Same scope as 443, optional | Only for the HTTP to HTTPS redirect, or ACME renewal if a public CA with HTTP validation is used. Omit if neither is needed. |
| RDP in | 3389/TCP | Restricted to the management subnet or a named jump host IP set only | Administration. Never open to the internet. |
| SSH in | 22/TCP | Not opened | Windows is administered over RDP and WinRM, not SSH. Open only if a specific tool genuinely requires it. |

### 7.2 Internal only (bound to loopback, no firewall rule exposes them)

PostgreSQL 5432, the Node backend port (for example 3001), SuperTokens core 3567, Elasticsearch 9200 if ever present, the metrics exporters, and any admin interface. These bind to 127.0.0.1 so IIS reverse proxies to them locally. Because they are on loopback, no inbound firewall rule is created for them at all; loopback traffic does not traverse the firewall.

### 7.3 Outbound rules

Prefer default deny outbound with an allowlist. At minimum allow: 443 to the Dynamics 365 Business Central endpoint (ERP), 443 to GitHub (for the self hosted deploy runner and artifact download), 443 to the backup destination (network share, NAS, or cloud), NTP to the time source, and Windows Update or the internal WSUS. Everything else outbound is denied. If the client cannot support default deny outbound at first, allowlist the ERP and backup and update endpoints explicitly and tighten later.

### 7.4 Network flows in words

A tablet or web browser reaches IIS on 443. IIS terminates TLS, serves the static frontend, and reverse proxies `/api` and `/auth` to the Node backend on loopback. The backend talks to PostgreSQL and SuperTokens core on loopback, and reaches the ERP outbound over 443. Administrators reach RDP 3389 only from the management network. No client ever reaches the database, the backend port, or the auth core directly.

---

## 8. IIS vs Nginx

Recommendation: IIS. On Windows Server it is the native, supported, service integrated web server, and it is the maintainable choice for this deployment.

| Criterion | IIS | Nginx on Windows |
|---|---|---|
| Windows compatibility | Native role, first class | Community Windows port, weaker OS integration |
| HTTPS / TLS | HTTP.sys kernel mode TLS, Windows certificate store, HTTP/2 | Works, but no certificate store integration, manual cert files |
| Reverse proxy | ARR plus URL Rewrite, mature | Native and capable, but the Windows build lags the Linux build |
| Performance on Windows | Tuned for the platform | The Windows port historically underuses Windows I/O completion; fine at this scale but not its home turf |
| Management | IIS Manager GUI, `appcmd`, PowerShell `WebAdministration` | Config files only, no service tooling |
| Logging | W3C logs, integrates with Windows tooling | Its own log files |
| Security | Request filtering, integration with Windows auth and Defender | Manual |
| Maintenance | Patched through Windows Update | Manual updates of a community build |
| CI/CD integration | PowerShell `WebAdministration`, `appcmd` scripted from the deploy runner | Scripted config file edits |

Do not use iisnode to host the Node process inside IIS. It is effectively unmaintained. The clean pattern is: Node runs as its own Windows Service on loopback, and IIS reverse proxies to it. That keeps the web tier and the app tier independently restartable and independently observable.

IIS responsibilities in this deployment: terminate TLS, enforce HSTS and security headers, serve the static React build as the site root, reverse proxy `/api/*` and `/auth/*` to the Node backend, apply request size limits and basic rate limiting, and write W3C access logs.

---

## 9. Backend deployment

### 9.1 Directory and releases

The backend lives under `C:\Zedral` (Section 25). Deployments are release based: each build lands in a timestamped or version stamped folder under `releases`, and a `current` junction or the service configuration points at the active release. This makes rollback a pointer swap plus a service restart rather than an in place overwrite.

### 9.2 Environment and secrets

Configuration comes from environment variables set on the Windows Service, never from files committed to Git. Secrets (database password, SuperTokens API key, ERP service credential, session secret, service token) are stored using DPAPI encrypted files readable only by the service account, or Windows Credential Manager, or a client provided vault. The audit's finding F5 (shipped default secrets that only warn) must be turned into a hard fail: the backend refuses to boot in a non local environment if any default secret, default database credential, or default seeded PIN is still present.

### 9.3 Process management, restart, health, shutdown

The Node backend runs as a Windows Service through WinSW. The service is configured to start on boot, to restart automatically on failure with a backoff, and to redirect stdout and stderr to rotating log files. A `/health` endpoint (liveness plus a database ping plus a SuperTokens reachability check) is polled by IIS and by a PowerShell watchdog. Graceful shutdown: the service stop signal triggers the backend to stop accepting new connections, finish in flight requests within a timeout, flush logs, and close the database pool cleanly. The client error boundary and offline banner the audit asked for (finding F8) protect the operator experience when the backend is briefly unavailable.

### 9.4 Deployment and rollback

Deployment: the deploy runner fetches the built artifact, unpacks it into a new `releases` folder, sets environment and secrets, runs database migrations after a backup (Section 14), repoints `current`, restarts the backend service, and runs a health check and smoke test. Rollback: repoint `current` to the previous release, restart the service, and if the failed deploy included an irreversible migration, restore the pre migration database backup. Rollback is a rehearsed procedure, not an improvisation.

The backend is never exposed directly to the internet. It listens on loopback and is reached only through IIS.

---

## 10. Environment separation

Three environments, never blurred.

```
Development  ─►  UAT  ─►  Production
```

Development runs on developer machines and on Zedral's own infrastructure. It never touches the production ERP. UAT is a staging environment that mirrors production and integrates with the client's ERP UAT (sandbox) company. Production integrates with the ERP production company.

```
Zedral UAT         ◄──►   ERP UAT (Business Central sandbox company)
Zedral Production  ◄──►   ERP Production (Business Central production company)
```

Each environment uses its own ERP endpoint, its own ERP service credential, its own database, and its own secrets. Production ERP is never used for development or test capture. The client is asked to provide a Business Central UAT company (this is ERP open question OQ-19 in the integration plan) so that reads and, especially, write back can be validated before touching production. On this single server, UAT can be a separate small host or a separate environment on Zedral infrastructure; it does not have to be a second copy of this exact box, but it must point at ERP UAT.

---

## 11. ERP / SAP (Dynamics 365 Business Central) integration

The integration plan is the detailed source; this section is the deployment and operations view. Business Central is the ERP; Manifold is the connector; the model is read first with staged write back through an outbox.

```
Zedral Backend  ──►  Business Central API (OData v4 / REST)
```

### 11.1 Endpoints and authentication

UAT endpoint and production endpoint are separate and configured per environment (Section 10). Authentication depends on the deployment of Business Central, which is TBD: on premises Business Central typically exposes OData v4 or SOAP web services with a Web Service Access Key or Windows credential, while cloud Business Central uses REST with OAuth2 through Entra ID. Use a non interactive, renewable service credential (client credentials or a web service access key), stored in the vault, never in code or in the APK. Use a separate, narrowly scoped credential for write back, enabled only after write back is signed off.

### 11.2 Network path, firewall, TLS

If Business Central is on premises, the backend reaches it over the plant or corporate LAN, or over a site to site VPN or private link if it is in another network; the firewall allows outbound 443 (or the specific OData port) to the ERP host only. If Business Central is cloud, the backend reaches it outbound over 443 to the Microsoft endpoint. All ERP traffic is TLS. IP allowlisting on the ERP side (so only this server may call the API) is requested from the client where supported.

### 11.3 Reliability semantics

Timeouts are set explicitly on every ERP call. Transient failures (network, 429, timeout) retry with exponential backoff and a cap. Permanent failures (auth, 4xx schema) go to a dead letter queue and alert rather than retrying forever. Write back is idempotent, keyed on an entry id, so a retry never double posts. Every request carries a request id, and the ERP response (including the Business Central transaction or document id) is stored against the Zedral record and the `erp.writeback_job` outbox row. This gives a two way link: a Zedral capture maps to an ERP transaction id, and an ERP posting maps back to the originating request id.

### 11.4 Data synchronization

Reads are delta first, each entity keeping a watermark cursor, at the cadences in the integration plan (masters daily, orders and lots every 15 minutes, ledgers hourly or daily). Write back is staged to the outbox by default and switched to live posting only after UAT sign off. Raw payloads land durably before transform so a mapping fix can replay without re hitting the ERP.

### 11.5 Failure recovery

If the ERP is unreachable, floor capture continues unaffected (the ERP is not in the capture write path); reads serve the last synced masters and orders from the Zedral tables, and write back accumulates in the outbox and drains when the ERP returns. A reconciliation job compares captured output and consumption against the Business Central item and capacity ledgers daily and flags drift.

### 11.6 Information required from the client ERP / IT team

This is the concrete request list, grounded in the integration plan's open questions. Owner on the Zedral side: integration lead. Owner on the client side: Suraj Srivastava.

Business Central deployment (on premises or cloud) and version. The connection protocol (OData v4, SOAP, or REST) and the authentication method. The UAT (sandbox) company endpoint and the production company endpoint. Whether the manufacturing objects (production orders, routing, BOM, work and machine centers, capacity, stop and scrap codes, lot information) are exposed as standard APIs or require custom API pages to be built on the Business Central side (this is the largest dependency, integration plan OQ-03). API documentation and sample responses. The service credential for read, and a separate one for write back. IP allowlisting and any VPN or private link requirement. API rate limits and paging behavior. Whether change tracking or webhooks are available for near real time order refresh. The coil id to Lot No mapping and slit id handling (the genealogy spine, OQ-05). Where item specification, shift master, and quality or lot status live (each is either an ERP read or a Zedral owned master). The stop and scrap code lists and the costing method (for downtime reasons and loss valuation). Backfill history durations for orders, lots, and ledgers. Confirmation of the UoM conversion authority. Time zone and date format expectations (ISO 8601, Asia/Kolkata).

---

## 12. GitHub Actions pipeline

```
GitHub  ─►  Pull Request  ─►  CI  ─►  Build  ─►  Tests  ─►  Security checks
        ─►  UAT deploy  ─►  Manual approval  ─►  Production deploy
        ─►  Health check  ─►  Success or Rollback
```

Build, test, and security run on GitHub hosted runners (clean, disposable, no access to the production server). Deployment to the Windows Server runs from the server side, triggered by GitHub, so no management port is opened to the internet for CI/CD.

### 12.1 Pipeline stages

On pull request: install, lint, type or JSDoc check, run the unit and integration tests (the audit noted there are currently none, finding F19; a minimum smoke plus the existing `verify:rls`, `verify:rbac`, and state machine scripts must run here), and run security checks (dependency audit, secret scanning, static analysis). On merge to the release branch: build the backend and the client, produce artifacts, and deploy to UAT. Run UAT smoke and the ERP UAT integration check. Require a manual approval gate (a GitHub Environments protection rule) before production. On approval: deploy to production, run migrations after backup, health check, and either confirm success or roll back.

### 12.2 How deployment reaches the Windows Server

Options considered:

| Mechanism | Verdict |
|---|---|
| WinRM from a GitHub hosted runner | Rejected. Requires exposing WinRM (5985/5986) to the internet or through a tunnel. Do not open management ports for CI/CD. |
| PowerShell remoting from outside | Rejected for the same reason. |
| Self hosted GitHub Actions runner on the server or on a LAN deploy host | Recommended. The runner connects outbound to GitHub over 443 and pulls jobs; no inbound port is opened. |
| Docker registry plus server side pull | Not applicable; the deployment is native, not containerized. |
| Pull based deploy agent (server polls for an approved release) | Recommended alternative when a runner on the production network is not acceptable. |

Recommendation: a self hosted deploy runner, ideally on a small separate deploy host on the plant LAN rather than on the production server itself, used only for deployment. Build and test happen on GitHub hosted runners; the self hosted runner only pulls the approved artifact and runs the deploy steps (backup, migrate, swap release, restart service, health check, rollback on failure). If the client forbids a runner anywhere on the production network, use the pull based agent: a scheduled PowerShell task on the server polls a release location for a new approved version and applies it, with no inbound exposure and no arbitrary workflow code running on the box.

No management port is exposed to the internet in either recommended option.

---

## 13. Self hosted GitHub runner

Should a self hosted runner be installed on the Windows production server? Preferably not on the production server itself. Put it on a separate small deploy host on the plant LAN. If that is not possible and it must sit on the production server, it is acceptable only with the hardening below, because a runner executes workflow code and is therefore a real attack surface on a production box.

If a self hosted runner is used:

Security risks to acknowledge: a compromised repository or a malicious pull request could run code on the runner; the runner has whatever rights its service account has; secrets available to the runner could be exfiltrated. Never enable the runner for public pull request builds.

Controls: run the runner under a dedicated low privilege service account, not an administrator and not the app or database service account. Restrict the runner to the single Zedral repository and to the deployment workflow only. Do not give it repository wide or organization wide access. Separate build from deploy: build and test on GitHub hosted runners, and let the self hosted runner do deployment only, so it never runs untrusted build code. Grant the runner exactly the rights it needs (write to the releases folder, restart the specific Windows Services, run the backup and migrate scripts) and nothing more, using a constrained mechanism rather than blanket admin. Use ephemeral or cleaned workspaces so no build leaves state behind, and clean the work directory after every job. Keep the runner software patched. Log every runner job to the Event Log and the deploy log.

If a runner is not acceptable, the pull based deploy agent in Section 12 is the safer alternative: it runs no workflow code, opens no port, and only fetches signed, approved release artifacts.

---

## 14. Database migration during deployment

```
Application v1.4.1  ─►  Backup  ─►  Database migration  ─►  Application v1.4.2  ─►  Verify
```

Migrations run with node-pg-migrate as a gated step in the deploy, under the migrator role. The rules:

Ordering: migrations are versioned and applied in order; the deploy fails closed if the migration step fails and does not start the new application version. Backward compatibility: prefer the expand and contract pattern, so a migration is compatible with both the old and the new application version during the swap. Add columns and tables first (expand), deploy the new code, then remove the old columns in a later release (contract), rather than making a breaking change in one step. Backup before migration: every production migration is preceded by an automatic database backup, and the deploy records the backup location so rollback can find it. Verification: after migrating, run a schema and smoke check (the migration recorded itself, key tables and constraints exist, a representative query and a representative write succeed). Failure handling: if the migration fails, the deploy stops, the old application version stays live (because the swap has not happened yet), and the team is alerted. Rollback strategy: do not assume a migration can be reversed. Some are irreversible (a dropped column, a destructive transform). The reliable rollback is to restore the pre migration backup and repoint to the previous application release. Down migrations are used only for the reversible cases and are never trusted as the sole rollback path for data affecting changes.

This is also where the audit's atomicity fix matters (finding F6): multi step writes wrapped in a single transaction mean a mid migration or mid write failure leaves a consistent state rather than a half applied one.

---

## 15. Monitoring

Lightweight by design, because the box has two cores. The principle: keep the heavy parts (Prometheus, Grafana) off the production server, keep only tiny exporters on it, and back everything with PowerShell watchdog tasks that work even if the metrics stack is down.

### 15.1 What runs where

On the server: windows_exporter (system metrics) and postgres_exporter (database metrics), both small Go binaries, plus the backend `/health` and metrics endpoints. Also on the server: PowerShell scheduled tasks that check service state, disk space, backup age, and certificate expiry, and write to the Event Log and alert. Off the server (a separate small host or Grafana Cloud free tier, TBD): Prometheus scraping the exporters, and Grafana for dashboards and alerts. If no off box option exists, run a minimal Prometheus with short retention on box and accept the small cost, or lean entirely on the PowerShell watchdogs plus an uptime checker.

### 15.2 What is monitored

Windows Server: CPU, RAM, disk space and disk I/O, network, the state of the Zedral Windows Services (backend, PostgreSQL, SuperTokens, IIS), Event Viewer errors, and uptime.

Backend: API availability (via `/health`), response time, 4xx and 5xx rates, request volume, service restart count, and the health endpoint result.

Database: database size and growth, connection count against the limit, slow queries, lock waits, CPU and memory used by PostgreSQL, storage, and backup status (last successful backup and last successful restore test).

Infrastructure: TLS certificate expiry (alert well before expiry), disk utilization against the warning and critical thresholds, Windows Service failures, and (only if containers are ever used) container failures.

### 15.3 Alerting

Alerts go by email (a PowerShell task via SMTP) at minimum, and through Grafana if the off box stack is used. The floor alerts, which must fire even if the metrics stack is down, are: a Zedral service is not running, disk crossed critical, a backup did not run, and the certificate is near expiry.

Do not over build this. Two exporters, one dashboard, and a handful of watchdog tasks are the right size for this server.

---

## 16. Windows Event Logs

The Event Log is the Windows side of observability and correlates with the application logs.

Application events: the backend writes critical operational events (service start and stop, unhandled errors, failed database connections, failed ERP posts) to a custom Event Log source named `Zedral`, including the request id so an Event Log entry can be tied to an application log line. System events: hardware, driver, disk, and OS events in the System log. Security events: RDP logons and logon failures, account use, and privilege use in the Security log. Service failures: the Service Control Manager logs service crashes and restarts; the WinSW wrapper also logs to the service log. Scheduled task failures: Task Scheduler records the result of every backup, cleanup, and health job, and a failed task also writes to the Event Log and alerts. Authentication failures: RDP and Windows logon failures in the Security log, and application login failures (SuperTokens and PIN) in the application audit log.

Correlation: the backend stamps every error Event Log entry with the request id used in the structured application logs (Section 17 and 18). To investigate an incident, an operator finds the time and device, reads the structured application log for the request id, and cross references the Windows Event Log for the same request id and time window to see the system side (service restart, disk event, auth failure) around it.

---

## 17. Application logging

Structured JSON logs, one event per line. The audit found the backend logs only through `console.*` with no structure, request id, or aggregation (finding F18); this is the fix.

### 17.1 Format

Every backend log line is JSON with a stable shape:

```json
{
  "timestamp": "2026-09-26T10:20:30Z",
  "level": "ERROR",
  "service": "zedral-backend",
  "request_id": "abc123",
  "device_id": "tablet-017",
  "endpoint": "/api/assets",
  "status": 500,
  "message": "Database connection failed"
}
```

Use pino (a fast JSON logger for Node) writing to `C:\Zedral\logs`. IIS writes W3C access logs. PostgreSQL writes its own logs to its log directory. The Windows Event Log carries the critical events (Section 16). The database audit trail (already present in the app) records who changed what. ERP integration logs record every sync and write back with the request id and the Business Central transaction id, plus the outbox row.

### 17.2 Log categories

Application logs (pino JSON), IIS access logs (W3C), database logs (PostgreSQL), Windows Event Log (critical events), audit logs (the DB audit trail), and ERP integration logs (`erp.sync_watermark`, `erp.writeback_job`, plus structured lines).

### 17.3 Rotation and retention

Rotate application logs daily and by size, with a size cap per file, using pino's rotation or the WinSW log rotation, and clean old files with the scheduled log cleanup task (Section 26). Suggested retention, to confirm against the client's audit requirement (TBD): application and access logs 30 to 90 days, ERP integration logs 90 days, audit logs longer per the client's compliance retention. IIS and PostgreSQL logs on the same rotation discipline.

### 17.4 What must never be logged

PINs, passwords, session tokens, the SuperTokens API key, the ERP service credential, and any secret. Minimal employee PII only, and never sensitive personal data. Configure pino redaction paths so a token or credential in an object is stripped before it is written. Log the request id and device id, which are safe correlation keys, not the credentials behind them.

---

## 18. Request tracing

The goal: answer "Tablet 17 failed to synchronize at 3:20 PM" quickly.

```
Tablet  ─►  Request ID  ─►  API  ─►  Backend  ─►  Database / ERP  ─►  Response  ─►  Log
```

### 18.1 How correlation ids work

The tablet includes a request id (a generated correlation id) and its device id on every request, alongside the existing idempotency key. If the request id is absent, the backend generates one at ingress. The backend attaches the request id to the logging context so every log line for that request carries it, propagates it into database operations (as a statement comment or an audit field) and into ERP calls (as the external request id, linked to the returned Business Central transaction id), and returns it to the client in an `X-Request-Id` response header. The client stores the request id with each queued offline item so that when an item finally syncs, its server side trace is findable.

### 18.2 The trace in practice

To investigate the tablet 17 sync failure: filter the structured application logs by `device_id = tablet-017` around 15:20 Asia/Kolkata. Each matching line has a `request_id`. Follow that request id through the API log (which endpoint, what status), the backend log (what it did), the database log (any slow query or error), and the ERP log (if the request touched write back, the outbox row and any Business Central response). Cross reference the Windows Event Log for the same window (a service restart, a disk event, an auth failure). The offline outbox on the tablet shows whether the item is still queued, retried, or dead lettered. This end to end trace turns a vague complaint into a specific cause.

The audit's outbox hardening (finding F12) supports this: an item that gets a 409 (server already applied it) must be treated as success and removed, failures must not block the whole queue, and a stuck item must surface rather than silently stall.

---

## 19. Backup and disaster recovery

Backups are the recoverability priority made concrete, and they never live only on the same server.

### 19.1 Database backup

Daily full backup with `pg_dump` in custom format, run off peak by a scheduled task. Continuous WAL archiving (`archive_mode = on`, the archive command copying each WAL segment to a separate location) for point in time recovery between full backups. Retention on a grandfather father son schedule: for example 7 daily, 4 weekly, 12 monthly, to confirm against the client's policy (TBD). Encryption: backup files are encrypted at rest (7-Zip AES-256 or an equivalent), and the backup volume or share is itself encrypted; the encryption key lives in the vault, not beside the backups. Verification: every backup is checksummed, and a weekly job restores the latest backup into a scratch database and runs a row count and integrity check. Restore testing is part of the routine, not a fire drill.

### 19.2 Server and configuration backup

Back up the application configuration (`C:\Zedral\config` without secrets), the deployment configuration and release manifest, the IIS configuration (exported), the WinSW or NSSM service definitions, the firewall rule export, the scheduled task export, and the TLS certificates (stored securely, keys in the vault). Configuration lives in a config repository without secrets; secrets live only in the vault.

### 19.3 Off server storage

The primary backup copies are pushed off the server to a network share, a NAS, or cloud object storage (the client's backup infrastructure, or Azure Blob or S3), on the same schedule. A same server copy may be kept for fast local restore, but it is never the only copy. Off server is mandatory, because a lost server must not mean lost data.

### 19.4 RPO, RTO, and DR procedure

RPO (how much data loss is tolerable): with WAL archiving, the recovery point is the last archived WAL segment, so RPO is on the order of 5 to 15 minutes. With nightly dumps alone it would be up to 24 hours, which is why WAL archiving is included. Target RPO: 15 minutes or better. RTO (how long to recover): a database only restore targets under 1 hour; a full server rebuild from the documented runbook plus off server backups targets 2 to 4 hours, subject to the client confirming hardware availability (TBD). Disaster recovery procedure: provision a replacement Windows Server, run the deployment runbook (Section 27) to reinstall the runtimes and services, restore the latest database backup and replay WAL to the chosen recovery point, restore the configuration, point DNS or the plant network at the new server, and run the smoke tests. The future upgrade path to a lower RTO is a warm standby using PostgreSQL streaming replication to a second host, which is out of scope for a single server today but is the natural next step and is noted here so it is a deliberate choice, not an oversight.

---

## 20. Storage planning (approximately 126 GB free)

A practical split with deliberate reserve. These are starting allocations to refine against real growth.

| Area | Allocation | Notes |
|---|---|---|
| Windows and pagefile | Already consumed plus around 40 GB reserved | OS, updates, pagefile; do not crowd it. |
| Application, runtimes, and releases | 12 GB | The app plus a few retained release versions for rollback. |
| Database data and WAL | 30 GB | Manual capture grows slowly (tens of MB per month), but leave room for indexes, WAL, and years of records; move to a separate volume if available. |
| Logs | 10 GB | Application, IIS, and PostgreSQL logs under rotation. |
| Backups (local short term copy) | 20 GB | A local copy for fast restore; the authoritative copies go off server. |
| Temporary and build | 6 GB | Report generation scratch, deploy staging, temp. |
| Reserved and free | Around 8 GB kept free at all times, target 20 percent or more | Never run the volume to full. |

Disk thresholds: warning at 80 percent, critical at 90 percent, with the critical alert firing even if the metrics stack is down (PowerShell watchdog). On a single volume this is tight, so the log cleanup task and backup off loading are what keep it healthy. If a second volume exists, the highest value move is to put PostgreSQL data and WAL there, which also relieves the I/O bottleneck (Section 4.3).

---

## 21. Capacitor Android APK pipeline

```
GitHub  ─►  Frontend build  ─►  Capacitor sync  ─►  Android build  ─►  APK / AAB  ─►  MDM  ─►  Tablets
```

### 21.1 Build and signing

The frontend builds with Vite (the operator build target), Capacitor sync copies it into the Android project, and Gradle produces a signed APK or AAB in CI. The signing keystore is stored as a protected CI secret (GitHub Actions encrypted secret) or in a secure store, never in the repository. The signing key is backed up securely; losing it means never being able to update the installed app.

### 21.2 Versioning and build numbers

Semantic version for humans, plus a monotonically increasing Android `versionCode` derived from the CI run number so every build is uniquely ordered. The build stamps the version into the app so it is visible in diagnostics and reported to the backend and the MDM.

### 21.3 Release, distribution, and forced update

The signed artifact is uploaded to the MDM for distribution to enrolled tablets. Forced update: the MDM enforces a minimum app version policy, and the backend also exposes a minimum supported version through a config endpoint so the app can block itself and prompt for update if it is below the floor, independent of the MDM. Rollback: the MDM re pushes the previous approved version; old versions are retained so a bad release can be reverted on the fleet quickly.

### 21.4 API URL, authentication, tokens, and secrets

The API base URL is not hardcoded per plant. Prefer an MDM managed app configuration value (or a bootstrap config fetched at first run) so the same APK points at the correct plant server without a rebuild. For an on premises plant, this is the plant LAN URL of the server. Authentication is the SuperTokens session plus operator PIN. Token management: short lived access token with refresh, and on the native device the token is kept in Capacitor secure storage, not in web localStorage (the audit flagged the localStorage token as an XSS exposure, finding F9; native secure storage removes that on device). Offline functionality is required and is covered in Section 23.

No backend secret and no ERP credential is ever placed in the APK. The APK talks only to the backend, never to the database and never to the ERP directly.

---

## 22. MDM and application responsibility split

The MDM manages the device; the backend manages the application. They do not overlap.

| MDM owns | Backend owns |
|---|---|
| Device enrollment | Application authentication (SuperTokens plus PIN) |
| APK installation and updates | Business logic |
| Device inventory and app version reporting | Application data and the API |
| Device permissions and restrictions | The database |
| Kiosk mode (single app lockdown on the floor) | Application level device and user identity (device id linked to operator badge) |
| Remote wipe | Authorization and RBAC |
| Device compliance and device status | Audit trail of who did what |

The MDM makes sure the right app is on a locked down, compliant, wipe able device. The backend makes sure the right person, doing the right role, sees and changes the right data. The device id from the MDM enrolled tablet is recorded by the backend against captures for traceability, but device management commands (wipe, restrict, update) are the MDM's job, not the app's.

MDM platform is TBD. Candidates suited to an Indian, cost conscious plant fleet include Android Enterprise through managed Google Play with a provider such as Scalefusion, SOTI, Esper, or Microsoft Intune. The choice is a client decision (Section 30) and does not change the responsibility split above.

---

## 23. Offline and synchronization

Offline is required. The whole point of tablet capture on a plant floor is that it does not stop when the Wi-Fi drops, and the app already implements an offline outbox. So the design below is confirmed as needed, not optional.

Local storage: captures are written to IndexedDB on the device first, so a submission is durable locally before any network call. Offline queue and sync queue: queued items form an outbox that flushes when connectivity returns, on the `online` event and on a periodic retry. Retry: failed sends retry with backoff and a cap, and the audit's fixes apply (finding F12): a 409 from the server (the operation was already applied) is treated as success and the item is removed, one failing item does not block the whole queue, and the bearer token is refreshed before a flush if it may have expired. Idempotency: every operation carries an idempotency key so the server deduplicates, and a replay never creates a duplicate record. Timestamps: each item records the client capture time and the server records its received time, so ordering and lateness are visible. Version numbers: records carry a version for optimistic concurrency so a stale edit is detected rather than silently overwriting a newer one. Conflict resolution: capture is treated as append where possible (each submission is an immutable record), which makes true conflicts rare because an operator owns their own run; for edits, a version conflict is surfaced to a supervisor rather than resolved by blind last write wins. Failed synchronization handling: an item that cannot sync after its retry cap is dead lettered into a visible needs attention state for the operator and supervisor, never silently dropped, and is traceable by its request id (Section 18).

If, contrary to the codebase, a future deployment decided offline was not needed (for example a plant with guaranteed wired connectivity at every station), the implication would be simpler clients but zero tolerance for any network blip during capture, which is not a safe assumption on a shop floor. The recommendation is to keep offline support.

---

## 24. Windows production security baseline

Do not disable Windows security controls for convenience. The baseline below also closes the authentication findings the audit raised (F1 through F5), which are blockers before any real Goodluck data is captured.

Windows security updates: a defined patch window (through WSUS or a managed schedule), tested where possible, with reboots scheduled off peak. Windows Defender Antivirus: on, with carefully scoped exclusions for the PostgreSQL data directory to avoid an I/O penalty on the database files, and no other blanket exclusions. Windows Defender Firewall: default deny inbound, allowlisted as in Section 7. Restricted RDP: reachable only from the management subnet or a jump host, with strong credentials and multi factor authentication, and Network Level Authentication on. Strong authentication: no default or shared credentials anywhere; the audit's default secrets and seeded PINs (finding F5) become a hard boot failure in production; the deterministic SuperTokens password and null hash PIN backdoors (findings F3, F4) are removed; the header supplied role path (findings F1, F2) is made impossible in production so every API route is authenticated and fails closed. Dedicated service accounts: separate low privilege accounts (group managed service accounts where possible) for PostgreSQL, the Node backend, SuperTokens core, and the deploy runner, each with only the rights it needs. Least privilege: the app connects to the database as `zedral_app`, never as a superuser. HTTPS and TLS: TLS 1.2 and 1.3 only, weak protocols and ciphers disabled in Schannel, a valid certificate in the Windows store, and HSTS enforced at IIS. Database isolation: loopback only, unprivileged role, RLS enforced. Secrets management: secrets in a vault or DPAPI encrypted, set on the service, never in Git and never in the APK. API authentication and authorization: SuperTokens session on every route, RBAC enforced server side (the app already does this well; it just must fail closed). CORS: same origin in production (the app already uses same origin in production, which is correct; the permissive dev CORS in finding F26 must never reach production). Rate limiting: applied at IIS and at the app for sensitive endpoints (login, override) to blunt brute force and probing (findings F10, F27). Security headers: HSTS, Content Security Policy, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy set at IIS. Dependency scanning: npm audit and a scanner (Dependabot or equivalent) in CI, plus secret scanning. Container security: not applicable (native deployment); if any container is ever used, its image is scanned. Audit logging: the DB audit trail is on and covers privileged actions. Backup encryption: on, as in Section 19.

---

## 25. Directory structure

```
C:\Zedral
├── app          Active application code (or a "current" link to the active release)
├── config       Environment templates and non secret configuration
├── logs         Structured backend logs, plus pointers to IIS and PostgreSQL logs
├── backups      Local short term backup copies (authoritative copies go off server)
├── scripts      PowerShell automation (deploy, backup, health, cleanup, monitor, rollback)
├── releases     Version stamped release folders for rollback
└── temp         Build staging, report scratch, transient files
```

`app` holds the running code, or better a `current` junction that points at the active folder under `releases`. `config` holds configuration templates and non secret settings; real secrets are never here and never in Git, they live in the vault or DPAPI encrypted and are set on the service. `logs` holds the JSON application logs under rotation. `backups` holds only the local fast restore copy; the real backups are off server. `scripts` holds the PowerShell automation from Section 26. `releases` holds the last several deployed versions so rollback is a pointer swap. `temp` is scratch space that the cleanup task prunes.

Production secrets are never stored inside a Git repository. The repository holds code and non secret configuration templates only.

---

## 26. PowerShell automation

Concepts and safe, production oriented patterns for each repeatable operation. Every script sets `$ErrorActionPreference = 'Stop'`, writes a transcript, is idempotent, logs to the Event Log, and never deletes or overwrites without an explicit, bounded target. Illustrative sketches follow; the real scripts are parameterized and reviewed.

Server preparation: enable the IIS role with ARR and URL Rewrite, install Node, the JRE, and PostgreSQL, create the service accounts, and set folder ACLs so each service account can reach only its own directories.

Firewall rules: create the allowlist from Section 7 declaratively so a rerun is idempotent.

```powershell
# firewall (illustrative)
$ErrorActionPreference = 'Stop'
New-NetFirewallRule -DisplayName 'Zedral HTTPS in' -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow -Profile Domain,Private
New-NetFirewallRule -DisplayName 'Zedral RDP in (mgmt only)' -Direction Inbound -Protocol TCP -LocalPort 3389 -RemoteAddress 10.0.0.0/24 -Action Allow
# database, backend, and auth core bind to loopback: no inbound rule is created for them
```

Application deployment: fetch the approved artifact, unpack into a new `releases` folder, set environment and secrets on the service, back up the database, run migrations, repoint `current`, restart the backend service, and run the health check; abort and roll back on any failure.

Service restart: stop the backend service gracefully, wait for it to drain within a timeout, start it, and confirm it reports healthy.

Health check: call `/health`, assert a 200 and a healthy database and auth status, and alert on failure.

```powershell
# health check (illustrative)
$ErrorActionPreference = 'Stop'
try {
  $r = Invoke-RestMethod -Uri 'https://localhost/health' -TimeoutSec 10
  if ($r.status -ne 'ok') { throw "health status: $($r.status)" }
} catch {
  Write-EventLog -LogName Application -Source 'Zedral' -EntryType Error -EventId 5001 -Message "Health check failed: $_"
  # send alert
  exit 1
}
```

Backup: run `pg_dump` in custom format, encrypt the output, checksum it, copy it off server, and prune local copies past retention; write the result to the Event Log so the backup age watchdog can see it.

Log cleanup: remove application, IIS, and PostgreSQL log files older than the retention window, safely and by explicit path and age only.

Disk monitoring: check free space against the 80 percent warning and 90 percent critical thresholds and alert; this watchdog runs on a schedule and does not depend on the metrics stack.

Rollback: repoint `current` to the previous release, restart the backend, run the health check, and if the failed deploy included an irreversible migration, restore the recorded pre migration backup.

All of these run as Windows Scheduled Tasks (backup nightly, log cleanup daily, disk and certificate checks hourly or daily, health check frequently), and every task's success or failure is recorded so a silent failure is itself an alert.

---

## 27. Deployment runbook

Thirty steps. For each: Owner, Prerequisite, Action, Verification, and the Failure and Recovery path. Owners: Client IT (the client's infrastructure team), Zedral DevOps, Zedral Backend, Zedral Integration, Zedral Mobile, Client ERP (Suraj Srivastava), and Client sign off.

| # | Step | Owner | Prerequisite | Action | Verification | Failure and recovery |
|---|---|---|---|---|---|---|
| 1 | Verify Windows Server | Client IT | Server provisioned | Confirm edition, version, patch level, CPU, RAM, disk | Specs match Section 0.2; version recorded | Wrong spec: escalate to client before proceeding |
| 2 | Apply Windows updates | Client IT | Step 1 | Patch to current, reboot in window | Update history clean, server healthy after reboot | Failed update: roll back the update, retry in next window |
| 3 | Configure hostname and network | Client IT | Step 2 | Set hostname, static IP, DNS, domain join if used | Name resolves, static IP holds, reachable on LAN | Misconfig: revert to prior network settings |
| 4 | Configure firewall | Zedral DevOps | Step 3 | Apply the Section 7 allowlist by script | Rules present, only 443 (and mgmt RDP) inbound; loopback services unexposed | Lockout risk: keep an RDP session open while applying; revert rule on loss |
| 5 | Create service accounts | Client IT with Zedral DevOps | Step 3 | Create low privilege accounts for PostgreSQL, backend, SuperTokens, deploy runner | Accounts exist with scoped rights only | Over privilege: tighten before continuing |
| 6 | Install required runtimes | Zedral DevOps | Step 5 | Install Node LTS, JRE, IIS role plus ARR and URL Rewrite, PowerShell 7 | Versions correct, IIS responds on the box | Install failure: uninstall cleanly, reinstall pinned versions |
| 7 | Install Docker if selected | Zedral DevOps | Decision from Section 2 | Not selected for hosting; skip unless a scoped SuperTokens container is chosen | N/A or the one scoped container runs | If attempted and heavy: revert to native |
| 8 | Install and configure database | Zedral Backend | Step 6 | Install PostgreSQL 16, set `postgresql.conf` and `pg_hba.conf` (loopback only), tune memory | Service runs, listens on loopback only, tuning applied | Bad config: restore default conf, reapply from script |
| 9 | Configure database users | Zedral Backend | Step 8 | Create `zedral_prod`, `zedral_migrator`, `zedral_app` with least privilege | Roles exist, app role is unprivileged, superuser not used by app | Wrong grants: revoke and reapply |
| 10 | Deploy backend | Zedral DevOps | Steps 6, 9 | Place release, set env and secrets, install the Windows Service via WinSW | Service starts, binds loopback, `/health` returns ok | Boot fail: check secrets not defaulted; fix and restart |
| 11 | Configure reverse proxy | Zedral DevOps | Steps 6, 10 | Configure IIS site, ARR proxy for `/api` and `/auth`, static root for the client build | Web loads, API proxied, static served | Proxy misroute: correct URL Rewrite rules |
| 12 | Configure HTTPS | Zedral DevOps with Client IT | Certificate available | Install the cert in the Windows store, bind 443, enforce TLS 1.2/1.3 and HSTS | HTTPS valid, weak protocols disabled, HSTS present | No cert: obtain from client CA or public CA; do not run plain HTTP |
| 13 | Configure secrets | Zedral DevOps | Vault or DPAPI ready | Set all secrets on the services, remove any defaults | No default secret present; app boots only with real secrets | Leak risk: rotate any exposed secret immediately |
| 14 | Configure monitoring | Zedral DevOps | Steps 8, 10 | Install windows_exporter and postgres_exporter, wire off box Prometheus and Grafana or watchdogs | Metrics visible, watchdog tasks scheduled | No off box host: run minimal on box or rely on watchdogs |
| 15 | Configure logging | Zedral Backend | Step 10 | Enable pino JSON logs, IIS W3C, PostgreSQL logs, Zedral Event Log source, redaction | Logs written and structured, no secrets in logs | Secrets leaking: fix redaction before go live |
| 16 | Configure backups | Zedral DevOps | Step 8, off server target | Schedule pg_dump plus WAL archiving, encryption, off server copy, restore test | Backup runs, copy lands off server, restore test passes | Backup fails: fix before any real data capture |
| 17 | Configure GitHub Actions | Zedral DevOps | Repo access | Set up CI on hosted runners, deploy via self hosted deploy runner or pull agent | Pipeline builds, tests, and deploys to UAT | Runner exposure risk: lock down per Section 13 |
| 18 | Deploy UAT | Zedral DevOps | Step 17, UAT env | Deploy to the UAT environment pointing at ERP UAT | UAT healthy, smoke passes | UAT fail: fix before touching production |
| 19 | Test ERP UAT integration | Zedral Integration with Client ERP | ERP UAT credentials and endpoints | Run reads and staged write back against the Business Central sandbox | Masters and orders sync, write back stages correctly | ERP gaps: log against the OQ list, resolve with Suraj |
| 20 | Client UAT | Client sign off with Zedral | Step 18, 19 | Client validates capture, reports, and ERP flows in UAT | Client accepts UAT behavior | Rejected: fix and re run UAT |
| 21 | Production approval | Client sign off | Step 20 | Formal go decision and the GitHub Environments approval | Approval recorded | No approval: hold |
| 22 | Production deployment | Zedral DevOps | Step 21 | Deploy the approved release to production | Services healthy, `/health` ok | Deploy fail: roll back to previous release |
| 23 | Database migration | Zedral Backend | Step 22, backup done | Run migrations after the automatic backup | Migration recorded, schema verified | Migration fail: restore pre migration backup, keep old release |
| 24 | Health check | Zedral DevOps | Step 22, 23 | Run the full health and smoke check | All green | Not green: roll back |
| 25 | APK build | Zedral Mobile | Signed keystore, prod API config | Build and sign the APK or AAB in CI with the production config | Signed artifact with correct version and API base | Build fail: fix signing or config |
| 26 | MDM deployment | Client IT with Zedral Mobile | MDM platform ready | Push the APK to enrolled tablets, set kiosk and version policy | App installs on the fleet, kiosk on, version reported | Push fail: check enrollment and MDM policy |
| 27 | Tablet validation | Zedral Mobile with floor supervisor | Step 26 | Validate login, capture, offline queue, and sync on real tablets | A tablet captures offline and syncs cleanly | Fails: check secure storage, API URL, token refresh |
| 28 | Production smoke testing | Zedral DevOps and Backend | Step 24, 27 | Walk one lot through the processes end to end | End to end capture, report export, and write back staging work | Fails: triage with the request id trace, roll back if needed |
| 29 | Backup verification | Zedral DevOps | Step 16, 23 | Confirm a production backup ran and a restore test passed | Backup present off server, restore test green | Fails: do not sign off until backups are proven |
| 30 | Go live sign off | Client sign off with Zedral | Steps 1 to 29 | Formal go live acceptance | Signed acceptance, on call and support path agreed | Outstanding items: list, own, and schedule before sign off |

---

## 28. Production readiness checklist

Marked Required, Recommended, or Optional.

Windows Server: supported version and edition confirmed (Required); patched to current (Required); reserve capacity respected, not fully allocated (Required).

Networking: static IP and DNS set (Required); LAN only posture confirmed or public exposure justified (Required); time sync configured (Required).

Firewall: default deny inbound with the allowlist applied (Required); RDP restricted to management (Required); default deny outbound with an allowlist (Recommended).

Backend: runs as a Windows Service with auto restart (Required); binds loopback, fronted by IIS (Required); `/health` and graceful shutdown working (Required); release based deploy with rollback (Required).

Database: PostgreSQL loopback only (Required); app runs as an unprivileged role (Required); tuned for the memory budget (Required); RLS enforced (Required); indexing verified against real volume (Recommended).

ERP / SAP: UAT and production endpoints and credentials separated (Required); read first with staged write back (Required); idempotency, retry, and dead letter in place (Required); reconciliation job running (Recommended); IP allowlisting on the ERP side (Recommended).

Security: no default or shared secrets, hard boot fail on defaults (Required); auth fails closed on every route, backdoors removed (Required); TLS 1.2/1.3 only with HSTS (Required); dedicated least privilege service accounts (Required); dependency and secret scanning in CI (Recommended); security headers and rate limiting at IIS (Recommended).

CI/CD: build and test on hosted runners (Required); deploy without exposing management ports (Required); manual approval gate before production (Required); self hosted runner hardened or replaced by a pull agent (Required if a runner is used).

UAT: a client provided ERP UAT company available (Required); Zedral UAT points only at ERP UAT (Required); client UAT sign off obtained (Required).

Monitoring: system, backend, and database metrics collected (Required); floor watchdogs for service, disk, backup age, and cert expiry (Required); dashboards off box (Recommended).

Logging: structured JSON logs with request id (Required); no secrets or sensitive PII logged (Required); rotation and retention set (Required); Event Log correlation (Recommended).

Backup: nightly full plus WAL archiving (Required); encrypted (Required); copied off server (Required); restore tested (Required).

Disaster recovery: RPO and RTO agreed (Required); DR rebuild runbook documented (Required); warm standby (Optional, future).

Android APK: signed with a securely stored keystore (Required); keystore backed up (Required); versioning and forced update in place (Required); API base URL managed, not hardcoded per plant (Recommended).

MDM: platform selected and tablets enrolled (Required); kiosk mode and restrictions set (Required); remote wipe and compliance configured (Required); responsibility split with the backend documented (Required).

Tablets: real device validation of login, capture, offline, and sync (Required); secure token storage on device (Required).

Documentation: runbook, architecture, and support path delivered (Required); the client ERP and IT questionnaire completed (Required).

Go live: all Required items green and signed off (Required); on call and support agreed (Required).

---

## 29. Client IT / ERP questionnaire

A questionnaire for the client's IT and ERP team. Responses go in the right hand column. Owner on the client side for the ERP section is Suraj Srivastava.

### 29.1 Server

| Question | Response |
|---|---|
| Windows Server version and edition | |
| Server hostname | |
| Static IP address | |
| Network segment / VLAN the server sits on | |
| DNS servers and internal domain | |
| Domain joined or workgroup | |
| Who holds administrator access, and how is it granted | |
| RDP access: from which networks or jump host, and is MFA available | |

### 29.2 Network

| Question | Response |
|---|---|
| Does the server have outbound internet, and through what path | |
| Firewall in front of the server, and who manages it | |
| Is there an outbound proxy the server must use | |
| Is a VPN or private link needed to reach the ERP | |
| Are the tablets and web users on the same plant LAN as the server | |
| Allowed outbound connections (ERP, GitHub, backup, updates) | |
| Allowed inbound connections (443 only, from where) | |

### 29.3 ERP / SAP (Dynamics 365 Business Central)

| Question | Response |
|---|---|
| Business Central deployment: on premises or cloud, and version | |
| UAT (sandbox) company endpoint | |
| Production company endpoint | |
| API documentation and sample responses available | |
| Authentication mechanism (OAuth2 / Entra, web service access key, Windows) | |
| Read credential, and a separate write back credential | |
| IP allowlisting supported on the ERP side | |
| VPN or private link requirement | |
| API rate limits and paging behavior | |
| Are manufacturing objects exposed as standard APIs or do custom API pages need building | |
| Required data set and the coil id to Lot No mapping | |
| Request and response format, UoM conversion authority, time zone | |

### 29.4 MDM

| Question | Response |
|---|---|
| MDM platform in use or planned | |
| Enrollment method | |
| Number of tablets on A-59 | |
| Android version(s) on the tablets | |
| Kiosk mode requirement | |
| Application installation method | |
| Application update mechanism | |

### 29.5 Security

| Question | Response |
|---|---|
| Password and account policies | |
| Certificate requirements (internal CA or public, who issues) | |
| Vulnerability scanning expectations | |
| Penetration testing expectations | |
| Data retention requirements | |
| Audit and logging requirements | |

### 29.6 Backup

| Question | Response |
|---|---|
| Existing backup policy the server must fit into | |
| Retention requirement | |
| Off site or off server storage available (share, NAS, cloud) | |
| Recovery point objective (acceptable data loss) | |
| Recovery time objective (acceptable downtime) | |

---

## 30. Risks and mitigations

| Risk | Why it matters here | Mitigation |
|---|---|---|
| 2 CPU cores | Every service shares two cores; concurrency causes contention | One Node instance, bounded PostgreSQL parallelism, off peak backups and reconciliation, serialized report exports, metrics stack off box |
| 16 GB RAM | Little slack, especially if Elasticsearch is added | Fixed memory budget with 5 GB reserved; do not run Elasticsearch on this box; use PostgreSQL search instead |
| 126 GB storage | Single volume, backups and logs and DB contend | Strict allocation, 80/90 percent thresholds, log cleanup, backups off loaded off server |
| Windows Server target | Linux tooling does not port cleanly | Native Windows stack (IIS, Windows Services, PowerShell), no Docker Desktop, no WSL2 hosting |
| Database on the same server as the backend | A resource spike in one starves the other; one failure domain | Memory and CPU budgets, separate volume for PostgreSQL if available, disciplined backups and a DR runbook |
| ERP dependency | The plant plan and identity come from Business Central | ERP not in the capture write path, staged write back, outbox drains on reconnect, reconciliation job; the OQ list closed with Suraj |
| Tablet connectivity | Plant Wi-Fi is unreliable | Offline outbox with retry, idempotency, and dead lettering; capture never blocks on the network |
| MDM dependency | The fleet is managed through the MDM | Clear MDM and backend responsibility split; backend enforces its own auth so a device issue is not a data issue |
| Single server architecture | One box is a single point of failure | Off server backups, tested restores, documented rebuild runbook; warm standby as the future upgrade |
| Backup failure | A silent backup failure is discovered only when it is too late | Backup age watchdog that alerts even if the metrics stack is down; weekly restore test; off server copies |
| Network failure | LAN or internet path drops | Offline capture continues; ERP write back queues; monitoring alerts on loss of connectivity |
| APK update failure | A bad release could reach the whole fleet | MDM staged rollout, retained previous versions, forced update floor, quick MDM rollback |

---

## 30.5 Decisions that depend on open information

Before this architecture is final, these decisions hang on information that is still TBD. The table names each dependency, what is known, and what the decision waits on.

| Input | Status | Decisions it drives |
|---|---|---|
| Backend technology | Known: Node plus Express | Process management (Windows Service via WinSW), reverse proxy pattern, memory budget. Settled. |
| Database technology | Known: PostgreSQL | Install method, tuning, backup and PITR approach, connection pooling. Settled. |
| Windows Server version | TBD | Available features (container support, gMSA), update path, IIS version specifics. Affects Steps 1, 6, 8 of the runbook. |
| Number of tablets | TBD (HSL ran 16) | Concurrent load at shift change, offline sync burst sizing, MDM licensing. Affects CPU headroom planning. |
| Number of concurrent users | TBD | API request rate, database connection pool size, IIS and rate limit tuning. |
| Network topology | TBD | Whether anything is internet exposed, the firewall posture (LAN only vs public 443), the ERP network path. Drives Section 7. |
| Internet availability on the server | TBD | Whether the self hosted deploy runner and outbound ERP and backup paths work, or a pull agent and internal mirrors are needed. Drives Section 12. |
| ERP / SAP architecture | Partly known: Dynamics 365 Business Central; on prem vs cloud TBD | Connection protocol, auth method, custom API page dependency, VPN need. Drives Section 11. |
| MDM platform | TBD | Enrollment, kiosk, forced update, and app config delivery mechanics. Drives Section 22. |
| Offline requirement | Known: required | Client complexity, sync design, idempotency and conflict handling. Settled (keep offline). |
| Data volume and retention | TBD | Storage allocation, backup retention, log retention, index strategy. Drives Sections 19 and 20. |
| Expected API traffic | TBD | CPU and memory sizing, pool size, whether a second instance or a bigger box is ever needed. Drives Section 4. |
| Elasticsearch need for single plant M1 | TBD | Whether it runs on this box (not recommended), on a separate host, or is replaced by PostgreSQL search. Drives Section 4. |

---

## 31. Final consolidated architecture

```
                                   GitHub (source, PRs)
                                          │
                                   GitHub Actions
                          build · test · security  (hosted runners)
                                          │
                                        UAT
                              (Zedral UAT  ◄──►  ERP UAT sandbox)
                                          │
                                   Manual approval
                                          │
                                          ▼
        ┌──────────────────────────────────────────────────────────────────────┐
        │                    WINDOWS PRODUCTION SERVER                           │
        │                 (native, 2 cores, 16 GB, ~126 GB)                      │
        │                                                                        │
        │   Client 443  ─►  IIS  (TLS · HSTS · static frontend · reverse proxy)  │
        │                     │                                                  │
        │                     ▼  loopback                                        │
        │                  Backend / API  (Node, Windows Service)                │
        │                     │                    │                             │
        │            loopback ▼                    ▼ loopback                     │
        │                 PostgreSQL          SuperTokens core                   │
        │              (loopback only)          (auth, JVM)                      │
        │                                                                        │
        │   Alongside:  Monitoring (exporters + watchdogs)                       │
        │               Logging (JSON + IIS + PostgreSQL + Event Log + audit)    │
        │               Backup (pg_dump + WAL → off server)                      │
        │               Security (firewall · TLS · least privilege · secrets)    │
        │                                                                        │
        │   Deploy in via: self hosted deploy runner OR pull agent (outbound)    │
        └──────────────────────────────────────────────────────────────────────┘
             │ outbound 443                    ▲ HTTPS                ▲ HTTPS
             ▼                                 │                     │
     ERP / SAP (Business Central)        Web users               Tablets (APK)
      read first · staged write back     on plant LAN         managed by MDM
                                                              (kiosk, updates,
                                                               wipe, inventory)
```

How to read it. Everything is built, tested, and security scanned on GitHub before it ever touches the server, then proven in UAT against the ERP sandbox, then released to production only after a human approval. Inside the Windows Server, the only door open to clients is IIS on 443; IIS terminates TLS, serves the frontend, and passes API traffic inward over loopback to the backend, which is the only component that talks to the database, to the auth core, and outward to the ERP. Monitoring, logging, backup, and security wrap the whole box. Outside the server, the ERP is reached only outbound and read first, the tablets are managed by the MDM and reach the backend only over HTTPS, and web users reach it the same way. The database and the ERP are never reachable by a client, and no secret ever leaves the server for the tablets.

---

## Bottom line

For this two core Windows Server, the right architecture is native, not containerized: IIS as the TLS terminating reverse proxy and static host, the Node backend and SuperTokens core as loopback bound Windows Services, and PostgreSQL installed natively and bound to loopback with an unprivileged application role. Co locating the database removes most of the serverless latency the audit flagged, but the authentication and transactional integrity blockers from that audit must be closed before any real Goodluck data is captured. Offline capture stays, because the shop floor demands it. The ERP integration is read first with staged write back through an outbox, proven in a Business Central sandbox before production. CI/CD deploys through an outbound only path so no management port faces the internet. Backups are encrypted, copied off server, and restore tested. Monitoring and logging are deliberately lightweight so they do not tax the two cores. The open items in Section 30.5 are the information to gather from the client before this is final, and none of them change the shape above; they size it and secure it.

*Grounded in the Zedral A-59 codebase and audit, the M1 ERP integration plan, and the project record. Facts not yet established are marked TBD and are not assumed.*
