# Rate limiting

Form sites that proxy to an upstream can limit how many requests a client may send. Caddy itself
enforces the limits; Caddy Visualizer only writes the configuration. Requests above a limit get
`429 Too Many Requests` with a `Retry-After` header.

Rate limiting is **not part of the standard Caddy image**. It needs the third-party module
[`github.com/mholt/caddy-ratelimit`](https://github.com/mholt/caddy-ratelimit) compiled into your
Caddy binary. Without it, everything else keeps working: the editor shows _Module missing_, offers
no new rules, and refuses to save enabled rules, so Caddy is never sent a configuration it
cannot read.

## Supported versions

| Component       | Version                                                        |
| --------------- | -------------------------------------------------------------- |
| Caddy           | 2.10 or newer (tested with 2.11.7)                             |
| caddy-ratelimit | commit `5625512f24f6f59d6f64fb3aafe5eecff0b286db` (2026-06-12) |

The module has no regular releases; pin a commit. Older builds that do not register the
directive order show up as _Module missing_ as well.

## Build a Caddy image with the module

Next to your Caddy `docker-compose.yml`, create `caddy/Dockerfile`:

```dockerfile
ARG CADDY_VERSION=2.11.7
FROM caddy:${CADDY_VERSION}-builder AS builder
RUN xcaddy build \
    --with github.com/mholt/caddy-ratelimit@5625512f24f6f59d6f64fb3aafe5eecff0b286db

FROM caddy:${CADDY_VERSION}
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
```

In your Caddy service, replace `image:` with a build and keep everything else (volumes, the
Caddyfile mount, the admin socket) as it is:

```yaml
services:
  caddy:
    build: ./caddy
    image: caddy-ratelimit:2.11.7
    # … unchanged: ports, volumes, restart …
```

```sh
docker compose build caddy && docker compose up -d caddy
docker compose exec caddy caddy list-modules | grep rate_limit   # http.handlers.rate_limit
```

Caddy Visualizer does not need any change and no additional container. Open a site in the editor:
the rate limiting section shows _Module installed_.

## Update the custom image

The image no longer follows `caddy:latest`; update it on purpose:

1. Set the new Caddy version in `ARG CADDY_VERSION` (and the `image:` tag), optionally a newer
   module commit.
2. `docker compose build --pull caddy && docker compose up -d caddy`
3. Check `caddy list-modules` as above. If the module is missing after an update, Caddy Visualizer
   refuses changes to sites with enabled rules until it is back, or until you disable them.

To go back to the standard image, first disable or remove all rate limit rules (otherwise Caddy
rejects the configuration), then switch `build:` back to `image: caddy:2`.

## Configure limits

Edit a reverse proxy site → _Rate limiting_ → _Add rule_. Each rule has:

- **Name**: lower-case letters, digits and hyphens; unique per site. Caddy uses
  `<host>/<name>` as zone name in its logs and metrics.
- **Requests per window**: 1–100,000 requests per 1 s–24 h (`30s`, `1m`, `2h`), as a sliding
  window. There is no separate burst setting: the window itself allows short bursts.
- **Path** (optional): Caddy's `path` matcher, `*` as wildcard (`/api/*`, `/login`). Empty
  means every request of the site.
- **Count per**: how clients are told apart (see below).
- **Active**: inactive rules stay stored but are not generated.

Every matching rule counts independently; a request is rejected as soon as one of them is
exhausted. Typical setup: a generous general limit, a stricter one for `/api/*`, a strict one
for `/login`. Rate limiting runs before basic auth and before the proxy, so failed logins count
as well. Redirect sites cannot be limited: Caddy answers redirects before it checks limits.

## Client identification and proxies

| Count per            | Key             | Notes                                                                                    |
| -------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| Remote IP (default)  | `{remote_host}` | Address of the TCP connection; cannot be spoofed.                                        |
| Client IP            | `{client_ip}`   | Uses `X-Forwarded-For` only from proxies in `trusted_proxies`; otherwise like Remote IP. |
| Request header       | `{header.Name}` | Chosen by the client, e.g. an API key.                                                   |
| Cookie               | `{cookie.name}` | Chosen by the client, e.g. a session.                                                    |
| All clients together | constant        | One shared limit for the whole site or path.                                             |

- **Behind another reverse proxy** (Cloudflare, a load balancer, a second Caddy): with _Remote IP_
  every request comes from that proxy, so all clients share one limit. Use _Client IP_ and list
  the proxy in your main Caddyfile, never more than the proxies you control:

  ```caddyfile
  {
  	servers {
  		trusted_proxies static 192.0.2.10/32
  	}
  }
  ```

  Without `trusted_proxies`, Caddy ignores `X-Forwarded-For`: a client cannot dodge the limit by
  sending a fake header.

- **IPv6**: IP keys count per `/64`, the block a single customer usually gets, so a client cannot
  get around a limit by switching addresses inside it. IPv4 counts per address.
- **Shared NAT** (offices, mobile carriers, CGNAT): many people share one IPv4 address and one
  limit. Choose limits with that in mind.
- **Header and cookie keys** separate well-behaved clients (one bucket per API key), but they are
  no protection: a client can send a new value with every request. Requests without the header or
  cookie share one bucket.

## Limitations

- Limits are **per client and per Caddy instance**. Counters live in the memory of that Caddy
  process. They survive config reloads (every apply) but not a restart of Caddy.
- With several Caddy instances behind a load balancer, each instance counts on its own: a client
  can get up to _instances × limit_ requests. Caddy Visualizer manages one Caddy and does not set
  up the module's `distributed` mode (shared storage, eventually consistent). If you need it, add
  it in the main Caddyfile yourself.
- Memory grows with _events per window × tracked clients_. Very high limits on busy sites keep
  many timestamps per client; expired clients are removed every minute.
- Caddy Visualizer shows no rate limit statistics. 429 responses appear in the metrics' status
  codes, but these cannot be told apart from 429s sent by an upstream.
