/* English texts; the reference shape for every other language. */

type P = Record<string, string | number>;
const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export const en = {
  app: {
    name: "Caddy Visualizer",
    description: "Manage and observe a Caddy server",
    brandHome: "Caddy Visualizer – Dashboard",
  },
  nav: {
    main: "Main navigation",
    dashboard: {
      label: "Dashboard",
      short: "Overview",
      intro: "The last 24 hours and your sites at a glance.",
    },
    metrics: {
      label: "Metrics",
      short: "Metrics",
      intro:
        "Requests, status codes and response times from Caddy's access log.",
    },
    logs: {
      label: "Logs",
      short: "Logs",
      intro: "Individual requests, newest first.",
    },
    config: {
      label: "Caddy Config",
      short: "Config",
      intro: "Your Caddyfile and form sites, applied together.",
    },
    settings: {
      label: "Settings",
      short: "Settings",
      intro: "Connection to Caddy and log ingestion.",
    },
  },
  account: {
    menu: (user: string) => `Account of ${user}`,
    signedInAs: "Signed in as",
    appearance: "Appearance",
    system: "System",
    light: "Light",
    dark: "Dark",
    language: "Language",
    logout: "Log out",
  },
  languages: { en: "English", de: "Deutsch" },
  common: {
    backToOverview: "Back to overview",
    cancel: "Cancel",
    delete: "Delete",
    deleting: "Deleting …",
    saving: "Saving …",
    edit: "Edit",
    retry: "Try again",
    applying: "Applying …",
    dismiss: "Dismiss notice",
    none: "None yet",
    notConfigured: "The Caddy connection is not configured (CADDY_ADMIN_URL).",
  },
  login: {
    title: "Log in",
    subtitle: "Log in with your admin account.",
    username: "Username",
    password: "Password",
    submit: "Log in",
    submitting: "Logging in …",
    invalid: "Username or password is incorrect.",
    throttled: "Too many failed attempts. Please try again in a few minutes.",
    missing: "Please enter username and password.",
    insecureHttp:
      "This page is open over plain HTTP. Browsers keep the secure login cookie only on localhost, so logging in fails here. Open it over HTTPS, or set ALLOW_INSECURE_LAN_HTTP=true in the .env next to compose.yaml (trusted networks only) and restart.",
  },
  dashboard: {
    title: "Dashboard",
    sitesHeading: "Sites in Caddy",
    sitesLive: "Live from the running configuration",
    sitesCount: (n: number) =>
      `${plural(n, "site", "sites")}, live from the running configuration`,
    noSitesTitle: "Caddy serves no sites.",
    noSitesText: "Add a site under Config or write it into the Caddyfile.",
    last24h: "Last 24 hours",
    allMetrics: "All metrics",
    noTrafficTitle: "No traffic data yet",
    noTrafficText:
      "As soon as Caddy's access log is read, requests, traffic and status codes appear here.",
    requestsPerHour: "Requests per hour",
  },
  runningSites: {
    https: "HTTPS",
    http: "HTTP",
    noTarget: "No target detected",
    form: "Form",
    manual: "Manual",
    login: "Login",
    edit: (host: string) => `Edit ${host}`,
    proxy: (upstreams: string) => `→ ${upstreams}`,
    files: (root: string | null) => (root ? `Files from ${root}` : "Files"),
    redirect: (status: number, location: string) =>
      `Redirect (${status}) to ${location}`,
    respond: (status: number) => `Fixed response (${status})`,
  },
  metrics: {
    title: "Metrics",
    range: "Time range",
    ranges: { "24h": "24 hours", "7d": "7 days", "30d": "30 days" },
    host: "Host",
    allHosts: "All hosts",
    requestsPerHour: "Requests per hour",
    requestsPerDay: "Requests per day",
    emptyTitle: "No traffic data yet",
    emptyText:
      "Metrics come from Caddy's access log. Add import access_log to your sites (see the README).",
    tiles: {
      requests: "Requests",
      traffic: "Traffic",
      serverErrors: "Server errors (5xx)",
      avgTime: "Avg. response time",
      requestCount: (n: string) => `${n} requests`,
      max: (value: string) => `max. ${value}`,
    },
    chart: {
      bar: (label: string, requests: string, errors: string) =>
        `${label}: ${requests} requests, ${errors} server errors`,
      requests: (n: string) => `${n} requests`,
      errors: (n: string) => `${n} server errors`,
      asTable: "As table",
      period: "Period",
      requestsColumn: "Requests",
      errorsColumn: "Server errors",
      hourLabel: (label: string) => label,
    },
    status: {
      heading: "Status codes",
      empty: "No requests in this period.",
      "2xx": "Success",
      "3xx": "Redirect",
      "4xx": "Client error",
      "5xx": "Server error",
      intro:
        "How the responses split up, and how each class and code ran over time.",
      classesHeading: "By class over time",
      classesNote: "Each chart has its own scale.",
      codesHeading: "By status code",
      peak: (value: string) => `peak ${value}`,
      share: (value: string) => `${value} of all`,
      seriesLabel: (name: string, total: string, peak: string) =>
        `${name}: ${total} requests, peak ${peak} per period`,
      code: "Code",
      meaning: "Meaning",
      requests: "Requests",
      shareColumn: "Share",
      peakColumn: "Peak",
      moreCodes: (n: number) =>
        `${n} more ${n === 1 ? "code" : "codes"} in the table`,
    },
    hosts: {
      heading: "Hosts",
      empty: "No requests in this period.",
      host: "Host",
      requests: "Requests",
      traffic: "Traffic",
      errors: "5xx",
      avgTime: "Avg. time",
    },
  },
  logs: {
    title: "Logs",
    filter: "Filter logs",
    host: "Host",
    status: "Status",
    all: "All",
    pathContains: "Path contains",
    apply: "Filter",
    reset: "Reset",
    noMatchTitle: "No matching entries",
    noMatchText: "No requests in the last 14 days match these filters.",
    emptyTitle: "No logs yet",
    emptyText:
      "Caddy requests of the last 14 days appear here once the access log is read (see the README).",
    time: "Time",
    request: "Request",
    duration: "Duration",
    size: "Size",
    older: "Older entries",
  },
  settings: {
    title: "Settings",
    moreTitle: "More settings to come",
    moreText:
      "Account and retention settings will live here. Appearance, language and logout are in the account menu.",
    caddy: {
      heading: "Caddy connection",
      connection: "Connection",
      connected: "Connected",
      notConfigured: "Not configured",
      lastSync: "Last successful sync",
      lastRevision: "Last applied revision",
      running: "Running configuration",
      matches: (n: number) => `Matches revision #${n}`,
      differs: (n: number) =>
        `Does not match revision #${n}, the last one applied by Caddy Visualizer. This is not a Caddy error: usually the Caddyfile was changed and reloaded outside. The next change here applies the current state again.`,
    },
    ingestion: {
      heading: "Access log",
      status: "Status",
      states: {
        idle: "Starting …",
        ok: "Reading",
        missing: "File not found",
        unreadable: "No read permission",
        error: "Reading failed",
        passive: "Another instance is reading",
      },
      lastRun: "Last run",
      skipped: "Skipped lines",
      gaps: "Gaps",
      missingHelp:
        "Caddy does not write an access log here yet. Setup: README, section “Prepare Caddy”.",
      unreadableHelp:
        "The file is not readable for the manager (UID 1000), usually because Caddy created it before “mode 644” was in the Caddyfile. Run once:",
    },
  },
  config: {
    title: "Caddy Config",
    heading: "Sites",
    intro:
      "Caddy reads its sites from two equal sources: your Caddyfile and the form sites. You edit both here.",
    caddyfileCard: {
      title: "Caddyfile",
      text: "Sites you write yourself, with everything Caddy can do.",
      action: "Edit Caddyfile",
    },
    formCard: {
      title: "Form sites",
      text: "Reverse proxies and redirects by form, written to sites.caddy.",
      none: "No form sites yet",
      count: (n: number, enabled: number) =>
        `${plural(n, "site", "sites")}, ${enabled} enabled`,
      action: "Add site",
    },
    siteCount: (n: number) => plural(n, "site", "sites"),
    formSitesHeading: "Form sites",
    notices: {
      created: (host: string) => `${host} was created.`,
      updated: (host: string) => `Changes to ${host} were saved.`,
    },
    apply: {
      applied: "Caddy took the configuration.",
      failed:
        "Caddy did not take the configuration and keeps running the previous one.",
      pending: "Whether Caddy took the configuration is still being checked.",
      notConfigured:
        "The Caddy connection is not configured; the change is only stored.",
    },
    sync: {
      synced: "Caddy in sync",
      applying: "Applying …",
      checking: "Checking status",
      failed: "Apply failed",
      "recovery-required": "Status unclear",
      "out-of-sync": "Not applied",
      idle: "Nothing applied yet",
      "other-instance": "Another instance is active",
      "not-configured": "Caddy connection not configured",
    },
    syncDetail: {
      appliedLine: (n: number, at: string | null) =>
        `Caddy runs revision #${n}${at ? `, applied ${at}` : ""}.`,
      noneApplied: "No revision has been applied successfully yet.",
      applying: "The stored configuration is being sent to Caddy right now.",
      checking: (n: number | string) =>
        `Revision #${n} still lacks Caddy's confirmation, e.g. after a restart of Caddy Visualizer.`,
      unclear: "The result of the last apply is unclear.",
      notTaken: "Caddy did not take the configuration.",
      outOfSync: "The stored configuration is not active in Caddy yet.",
      idle: "As soon as you save the Caddyfile or add a form site, the configuration is checked and applied to Caddy.",
      otherInstance:
        "Another Caddy Visualizer instance manages this Caddy configuration. This one stores changes but applies nothing. Only one instance may run.",
      notConfigured:
        "Changes are only stored until the connection to Caddy is set up.",
      applyAgain: "Apply again",
      applyNow: "Apply now",
      checkStatus: "Check status",
    },
    revisionStatus: {
      pending: "Prepared",
      loading: "Loading",
      applied: "Applied",
      failed: "Failed",
      "recovery-required": "Unclear",
    },
    triggers: {
      "site-created": "Site added",
      "site-updated": "Site changed",
      "site-enabled": "Site enabled",
      "site-disabled": "Site disabled",
      "site-deleted": "Site deleted",
      retry: "Applied again",
      rollback: "Restored",
      "caddyfile-updated": "Caddyfile edited",
    },
    history: {
      heading: "History",
      text: (n: number) => `The last ${n} applies to Caddy`,
      lastApplied: "Last applied",
      rollbackTo: (n: number) => ` (to #${n})`,
    },
    rollback: {
      button: "Restore",
      title: (n: number) => `Restore revision #${n}?`,
      text: (date: string) =>
        `This configuration from ${date} becomes the current one again: the form sites are set to their state then and applied to Caddy. Later changes are replaced; they stay traceable in the history.`,
      summary: (n: number, enabled: number) =>
        `${plural(n, "form site", "form sites")}, ${enabled} enabled`,
      enabled: "enabled",
      disabled: "disabled",
      more: (n: number) => `and ${n} more`,
      none: "No form sites: all form sites are removed.",
      restoresMain: "The Caddyfile is set to this state as well.",
      failed: "The revision could not be restored.",
      notFound: "This revision does not exist.",
    },
    preview: {
      heading: "Generated configuration",
      text: "sites.caddy, generated from the stored enabled form sites. Read-only; it is sent to Caddy when applying. Password hashes are hidden.",
      ariaContent: "Content of sites.caddy",
      activeSites: (n: number) => plural(n, "enabled site", "enabled sites"),
      currentStatus: "Current status",
      lastApplied: "Last successful apply",
      revision: (n: number, at: string | null) =>
        `Revision #${n}${at ? `, ${at}` : ""}`,
      matches: " (matches this preview)",
      differs: "different configuration",
    },
    list: {
      hostname: "Hostname",
      upstream: "Upstream",
      target: "Target",
      tls: "TLS",
      basicAuth: "Basic auth",
      redirect: (code: number) => `Redirect ${code}`,
      redirectTo: "Redirect to",
      changed: "Changed",
      status: "Status",
      active: "Enabled",
      inactive: "Disabled",
      activeLabel: (host: string) => `${host} enabled`,
      edit: "Edit",
      editLabel: (host: string) => `Edit ${host}`,
      deleteLabel: (host: string) => `Delete ${host}`,
      enabledNotice: (host: string, enabled: boolean) =>
        `${host} was ${enabled ? "enabled" : "disabled"}.`,
      deletedNotice: (host: string) => `${host} was deleted.`,
      deleteTitle: "Delete site?",
      deleteText:
        "is removed from the form sites. This cannot be undone. To switch the site off temporarily, disable it instead.",
    },
    tls: {
      automatic: {
        short: "Automatic HTTPS",
        title: "Automatic (HTTPS)",
        description:
          "Caddy obtains a certificate and redirects HTTP to HTTPS. The hostname must resolve publicly.",
      },
      off: {
        short: "HTTP only",
        title: "HTTP",
        description:
          "No certificate; the site is only reachable via http://. For internal services.",
      },
    },
    editor: {
      newTitle: "Add site",
      newSubmit: "Create site",
      editTitle: "Edit site",
      editSubmit: "Save changes",
      hostnameHint:
        "The address of the site, without http:// and without a path.",
      upstreamHint:
        "Where Caddy forwards requests: http:// or https://, host or IP and an optional port.",
      enabled: "Enabled",
      enabledHint:
        "Disabled sites stay stored but are left out of the generated configuration.",
      kind: "Type",
      kinds: {
        proxy: {
          title: "Reverse proxy",
          description: "Caddy forwards requests to an upstream.",
        },
        redirect: {
          title: "Redirect",
          description: "Caddy answers with a redirect to another URL.",
        },
      },
      redirectTarget: "Target",
      redirectTargetHint:
        "Absolute URL with http:// or https://. Placeholders such as {uri} (path and query) or {path} carry over parts of the request.",
      redirectCode: "Type of redirect",
      redirectCodes: {
        301: {
          title: "301 Permanent",
          description: "Browsers cache it; may become GET.",
        },
        302: {
          title: "302 Temporary",
          description: "Not cached; may become GET.",
        },
        307: { title: "307 Temporary", description: "Keeps method and body." },
        308: { title: "308 Permanent", description: "Keeps method and body." },
      },
      basicAuth: "Enable basic auth",
      basicAuthHint:
        "Caddy asks for a user name and password before forwarding any request. Requires HTTPS.",
      basicAuthActive:
        "Basic auth is active. The password is stored as a hash only.",
      username: "User name",
      usernameHint: "Letters, digits, dot, hyphen and underscore.",
      password: "Password",
      newPassword: "New password",
      passwordHint: (min: number) => `At least ${min} characters.`,
      keepPasswordHint: (min: number) =>
        `Leave empty to keep the current password. A new one needs at least ${min} characters.`,
      showPassword: "Show password",
      hidePassword: "Hide password",
      generatePassword: "Generate",
      generatedNotice:
        "Password generated. Note it down now: it cannot be shown again after saving.",
    },
    accessLog: {
      heading: "Access log for Caddyfile sites",
      text: "Sites in your Caddyfile only appear in metrics and logs when they import the access_log snippet. Caddy Visualizer adds the line for you; Caddy checks the result first, and every change can be rolled back.",
      enableAll: (n: number) =>
        `Enable for all (${plural(n, "site", "sites")})`,
      enableSelected: (n: number) => `Enable for selection (${n})`,
      allActive: "All sites in your Caddyfile write to the access log.",
      active: "Active",
      oneLine: "On one line: add it in the editor",
      snippetBelow:
        "Above the (access_log) snippet: move the snippet up in the editor",
      line: (n: number) => `Line ${n}`,
      select: (sites: string) => `Select ${sites}`,
      snippetMissing:
        "Your Caddyfile does not define the (access_log) snippet yet. Add it first (see README, “Prepare Caddy”).",
      saved: "import access_log was added.",
    },
    notFound: {
      title: "Site not found",
      text: "This site does not exist (anymore). Maybe it was deleted in the meantime.",
    },
    error: {
      title: "The Caddy configuration could not be loaded",
      text: "Loading the sites failed. Please try again.",
    },
    loading: "Loading sites …",
  },
  caddyfile: {
    title: "Caddyfile",
    heading: "Edit Caddyfile",
    intro:
      "Caddy's main Caddyfile, where it lives on the server. “Check” lets Caddy validate the text without changing anything. “Save & apply” loads it and writes the file only once Caddy accepted it.",
    rules:
      "The admin setting in the global block and the line import /config/manager/sites.caddy must stay.",
    replaced:
      "The Caddyfile was replaced on the server by a new file (e.g. by an editor that renames on save). Caddy and Caddy Visualizer still see the old version. Recreate both containers before saving here.",
    notWritable:
      "Caddy Visualizer (UID 1000) cannot write the Caddyfile. Checking works, saving does not. See the README, section “Prepare Caddy”.",
    unreadable: (path: string) => `The Caddyfile ${path} could not be read.`,
    content: "Content of the Caddyfile",
    check: "Check",
    save: "Save & apply",
    dirty: "Unsaved changes",
    clean: "Matches the file",
    accepted: "Caddy accepts the configuration.",
    unchanged: " No changes compared to the file.",
    saved: "The Caddyfile was saved. ",
    notSaved: "The Caddyfile was not changed. ",
    diffLabel: "Changes compared to the file",
    tooLarge: "The change is too large to compare.",
    skipped: (n: number) =>
      `⋯ ${plural(n, "unchanged line", "unchanged lines")}`,
    conflict:
      "The Caddyfile was changed elsewhere in the meantime. Please reload the page; copy your input first.",
    nothingToSave: "No changes compared to the file.",
  },
  actions: {
    siteSaveFailed: "The site could not be saved. Please try again.",
    changeFailed: "The change could not be saved. Please try again.",
    deleteFailed: "The site could not be deleted. Please try again.",
    siteGone: "This site no longer exists. The list was refreshed.",
    siteConflict:
      "The site was updated by another change in the meantime. Please reload the page.",
  },
  codes: {
    "validation.required": "Please enter a value.",
    "validation.tls": "Please choose a valid TLS mode.",
    "validation.enabled": "Invalid value for “enabled”.",
    "validation.invalid": "Invalid input.",
    "hostname.required": "Please enter a hostname.",
    "hostname.scheme":
      "Please enter only the hostname, without http:// or https://.",
    "hostname.whitespace": "The hostname must not contain spaces.",
    "hostname.path": "The hostname must not contain a path.",
    "hostname.wildcard":
      "Wildcard hostnames (*.example.com) are not supported yet.",
    "hostname.port": "The hostname must not contain a port.",
    "hostname.tooLong": "The hostname may have at most 253 characters.",
    "hostname.invalid":
      "Please enter a valid hostname (letters a–z, digits, hyphens and dots, e.g. app.example.com).",
    "hostname.incomplete":
      "Please enter a complete hostname with a domain, e.g. app.example.com.",
    "hostname.ip":
      "IP addresses are not supported as site address. Please enter a hostname.",
    "upstream.required":
      "Please enter an upstream, e.g. http://192.168.1.20:8080.",
    "upstream.characters":
      "The upstream must not contain spaces, line breaks or non-ASCII characters.",
    "upstream.scheme": "The upstream must start with http:// or https://.",
    "upstream.credentials":
      "The upstream must not contain credentials (user@).",
    "upstream.path": "The upstream must not contain a path, query or fragment.",
    "upstream.host":
      "Please enter a valid upstream host (hostname, IPv4 or IPv6 address).",
    "upstream.port": "The port must be a number between 1 and 65535.",
    "site.duplicate": "A site with this hostname already exists.",
    "accessLog.snippetMissing":
      "The Caddyfile does not define the (access_log) snippet; nothing was changed.",
    "accessLog.nothingToAdd": "The selected sites import access_log already.",
    "validation.kind": "Please choose reverse proxy or redirect.",
    "redirect.targetRequired": "Please enter a target URL.",
    "redirect.targetTooLong": ({ max }: P) =>
      `The target may have at most ${max} characters.`,
    "redirect.targetScheme":
      "The target must start with http:// or https://, e.g. https://www.example.com{uri}.",
    "redirect.targetChars":
      "The target may only contain URL characters and the placeholders {uri}, {path}, {query}, {host}, {hostport} and {scheme} (no spaces, quotes or #).",
    "redirect.targetInvalid": "This is not a valid URL with a host.",
    "redirect.code": "Please choose 301, 302, 307 or 308.",
    "redirect.noBasicAuth":
      "Basic auth is not available for redirects: Caddy would redirect before asking for credentials.",
    "basicAuth.usernameRequired": "Please enter a user name.",
    "basicAuth.usernameTooLong": ({ max }: P) =>
      `The user name may have at most ${max} characters.`,
    "basicAuth.usernameChars":
      "The user name may only contain letters, digits, dot, hyphen and underscore, starting with a letter or digit.",
    "basicAuth.passwordRequired": "Please enter a password.",
    "basicAuth.passwordTooShort": ({ min }: P) =>
      `The password needs at least ${min} characters.`,
    "basicAuth.passwordTooLong": ({ max }: P) =>
      `The password may be at most ${max} bytes long (fewer characters with umlauts or emoji).`,
    "basicAuth.passwordChars":
      "The password must not contain control characters.",
    "basicAuth.requiresHttps":
      "Basic auth needs HTTPS: without it, user name and password travel unencrypted. Choose “Automatic (HTTPS)”.",
    "rollback.invalidSnapshot":
      "The stored state of this revision is invalid and cannot be restored.",
    "overview.previewFailed":
      "The preview could not be generated because stored site data is invalid.",
    "main.invalidPath": "Invalid import path.",
    "main.importMissing": (p: P) =>
      `The Caddyfile must contain the line “import ${p.path}” exactly once.`,
    "main.sitesImportMissing": (p: P) =>
      `The Caddyfile must contain the line “import ${p.path}” exactly once; it holds the form sites.`,
    "main.adminChanged":
      "The admin setting in the global block cannot be changed here, or Caddy Visualizer would lose its connection to Caddy. Change it via SSH if needed.",
    "main.missing": "The content is missing.",
    "main.tooLarge": (p: P) => `The Caddyfile is larger than ${p.kib} KiB.`,
    "main.nul": "The content contains a null byte.",
    "apply.mainUnreadable": "The main Caddyfile could not be read.",
    "apply.staging": "The configuration file could not be prepared.",
    "apply.rejected": "Caddy could not take the configuration.",
    "apply.unreachable":
      "Caddy is not reachable or does not answer. Nothing was changed in the running configuration.",
    "apply.notTaken":
      "Caddy did not take the configuration and keeps running the previous one.",
    "apply.unknownOutcome":
      "Whether Caddy took the configuration is still unclear. The status is checked again.",
    "apply.ambiguous":
      "The running Caddy configuration matches neither this nor the previous revision, e.g. after a manual change. Please apply again.",
    "apply.promoteFailed":
      "Caddy took the configuration, but the files could not be updated. A restart of Caddy would load the previous state.",
    "apply.aborted":
      "Aborted before Caddy was contacted (Caddy Visualizer was restarted).",
    "apply.superseded":
      "Outcome no longer determinable; there is a newer revision.",
    "apply.invalidSites":
      "The stored sites are invalid. Nothing was sent to Caddy.",
    "apply.internal":
      "An internal error occurred while applying. Nothing was sent to Caddy.",
    "apply.manualConflict": (p: P) =>
      `The hostname ${p.hostname} is already used in the Caddyfile${p.pattern === p.hostname ? "" : ` (${p.pattern})`}. Form sites must not override sites there.`,
    "apply.otherInstance":
      "Another Caddy Visualizer instance manages this configuration. Nothing was sent to Caddy here.",
    "apply.rollbackSource":
      "Only revisions that were applied successfully once can be restored.",
    "apply.mainConflict":
      "The Caddyfile was changed elsewhere in the meantime. Please reload the page; copy your input first.",
    "apply.mainChanged":
      "Caddy took the configuration, but the Caddyfile was changed elsewhere meanwhile and was therefore not overwritten.",
    "apply.duplicateAddress": (p: P) =>
      `The site address ${p.address} is already defined in the Caddy configuration, e.g. in the Caddyfile.`,
    "apply.notConfigured": "The Caddy connection is not configured.",
    "caddy.timeout": "Caddy did not answer in time.",
    "caddy.unreachable": "Caddy's admin API is not reachable.",
    "caddy.rejected": (p: P) =>
      `Caddy rejected the request (HTTP ${p.status}).`,
    "caddy.invalidResponse": "Caddy returned an unexpected response.",
    "ingestion.gap":
      "A rotated log file was already deleted; entries in between are missing.",
  },
};

export type Messages = typeof en;
