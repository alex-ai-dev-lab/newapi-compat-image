# Security

## Secret Handling

Never commit local credentials. These paths and patterns are ignored by Git and Docker build context:

- `Token/`
- `*.secret`
- `*.local.env`
- `github-auth.env`
- `server-access.env`
- `.env`
- `id_rsa*`
- `*.pem`

Scripts must not use `set -x` and must not print token, password, sudo password, API key, or bearer values.

## Reporting

Open a private issue or contact the repository owner for security-sensitive reports.

## CI Checks

`security.yml` scans for high-risk token prefixes and verifies image layers do not include local secret files.
