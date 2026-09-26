# Zedral Windows layout (C:\Zedral)

```
C:\Zedral
├── app              Junction "current" → active release under releases\
├── config           Non-secret templates; secrets via DPAPI / Credential Manager only
├── logs             Backend JSON logs (pino)
├── backups          Local short-term copies (authoritative copies go off-server)
├── scripts          PowerShell automation (copied from deploy/windows/scripts)
├── releases         Version-stamped release folders
└── temp             Deploy staging / report scratch
```

Create with `Prepare-Server.ps1`. Never store production secrets in Git or under `config\` in plaintext.
