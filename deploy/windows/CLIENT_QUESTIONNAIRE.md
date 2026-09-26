# Client IT / ERP Questionnaire (Gate 0)

**Application:** Zedral M1 (A-59) — Windows production go-live  
**Client ERP contact:** Suraj Srivastava (suraj.srivastava@goodluckindia.com)  
**Status:** Awaiting client responses. Live server provisioning is blocked until Required items below are answered.

Fill the Response column. Mark N/A only when the question does not apply.

## Required before server provisioning

| # | Question | Response | Status |
|---|---|---|---|
| R1 | Windows Server version and edition | | OPEN |
| R2 | Server hostname and static IP | | OPEN |
| R3 | Network segment / VLAN | | OPEN |
| R4 | Tablets and web users on same plant LAN as server? (Y/N) | | OPEN |
| R5 | RDP access: jump host / management subnet + MFA available? | | OPEN |
| R6 | Who holds administrator access | | OPEN |
| R7 | TLS certificate: internal CA or public; who issues | | OPEN |
| R8 | Off-server backup destination (share / NAS / cloud path) | | OPEN |
| R9 | Backup retention and RPO / RTO targets | | OPEN |
| R10 | Outbound internet on server? Path / proxy? | | OPEN |

## Network

| Question | Response |
|---|---|
| Firewall in front of the server, and who manages it | |
| Allowed inbound (prefer 443 from plant LAN only) | |
| Allowed outbound (ERP, GitHub/releases, backup, Windows Update/WSUS, NTP) | |
| VPN or private link needed to reach ERP? | |

## ERP / Business Central (Suraj)

| Question | Response |
|---|---|
| On premises or cloud, and version | |
| UAT (sandbox) company endpoint | |
| Production company endpoint | |
| Auth mechanism (OAuth2 / Entra, web service access key, Windows) | |
| Read credential + separate write-back credential | |
| Manufacturing APIs standard or custom API pages? | |
| Coil id to Lot No mapping | |
| Time zone (expected Asia/Kolkata) | |

## MDM (deferred for this go-live — APK phase later)

| Question | Response |
|---|---|
| MDM platform in use or planned | |
| Number of tablets on A-59 | |
| Android version(s) | |

## Gate 0 checklist (Zedral)

- [ ] Questionnaire returned with Required rows filled
- [ ] RDP session proven from management network
- [ ] Admin rights confirmed for IIS / services / PostgreSQL install
- [ ] TLS cert or CA issuance path confirmed
- [ ] Off-server backup destination writable from the server
- [ ] Go / no-go recorded for live provisioning

**Hard stop:** Do not run `Prepare-Server.ps1` on the plant box until all Required items are closed.
