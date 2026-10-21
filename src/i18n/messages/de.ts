import type { Messages } from "./en";

type P = Record<string, string | number>;
const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export const de: Messages = {
  app: {
    name: "Caddy Visualizer",
    description: "Verwaltung und Beobachtung eines Caddy-Servers",
    brandHome: "Caddy Visualizer – Dashboard",
  },
  nav: {
    main: "Hauptnavigation",
    dashboard: {
      label: "Dashboard",
      short: "Übersicht",
      intro: "Deine Sites und die letzten 24 Stunden auf einen Blick.",
    },
    metrics: {
      label: "Metrics",
      short: "Metrics",
      intro: "Requests, Statuscodes und Antwortzeiten aus Caddys Access-Log.",
    },
    logs: {
      label: "Logs",
      short: "Logs",
      intro: "Einzelne Requests, die neuesten zuerst.",
    },
    config: {
      label: "Caddy Config",
      short: "Config",
      intro: "Deine Caddyfile und die Formular-Sites, gemeinsam angewendet.",
    },
    settings: {
      label: "Settings",
      short: "Settings",
      intro: "Verbindung zu Caddy und Einlesen der Logs.",
    },
  },
  account: {
    menu: (user) => `Konto von ${user}`,
    signedInAs: "Angemeldet als",
    appearance: "Darstellung",
    system: "System",
    light: "Hell",
    dark: "Dunkel",
    language: "Sprache",
    logout: "Abmelden",
  },
  languages: { en: "English", de: "Deutsch" },
  common: {
    backToOverview: "Zur Übersicht",
    cancel: "Abbrechen",
    delete: "Löschen",
    deleting: "Löschen …",
    saving: "Speichern …",
    edit: "Bearbeiten",
    retry: "Erneut versuchen",
    applying: "Wird angewendet …",
    dismiss: "Hinweis schließen",
    none: "Noch keine",
    notConfigured:
      "Die Caddy-Anbindung ist nicht konfiguriert (CADDY_ADMIN_URL).",
  },
  login: {
    title: "Anmelden",
    subtitle: "Melde dich mit deinem Admin-Konto an.",
    username: "Benutzername",
    password: "Passwort",
    submit: "Anmelden",
    submitting: "Anmelden …",
    invalid: "Benutzername oder Passwort ist falsch.",
    throttled:
      "Zu viele fehlgeschlagene Anmeldeversuche. Bitte in einigen Minuten erneut versuchen.",
    missing: "Bitte Benutzername und Passwort eingeben.",
    insecureHttp:
      "Diese Seite ist über unverschlüsseltes HTTP geöffnet. Browser behalten das sichere Login-Cookie nur auf localhost, die Anmeldung scheitert hier deshalb. Öffne sie über HTTPS oder setze ALLOW_INSECURE_LAN_HTTP=true in der .env neben der compose.yaml (nur in vertrauenswürdigen Netzen) und starte neu.",
  },
  dashboard: {
    title: "Dashboard",
    sitesHeading: "Sites in Caddy",
    sitesLive: "Live aus der laufenden Konfiguration",
    sitesCount: (n) =>
      `${plural(n, "Site", "Sites")}, live aus der laufenden Konfiguration`,
    noSitesTitle: "Caddy bedient keine Sites.",
    noSitesText:
      "Lege unter Config eine Site an oder trage sie in der Caddyfile ein.",
    last24h: "Letzte 24 Stunden",
    allMetrics: "Alle Metriken",
    noTrafficTitle: "Noch keine Zugriffsdaten",
    noTrafficText:
      "Sobald Caddys Access Log eingelesen wird, siehst du hier Requests, Traffic und Statuscodes.",
    requestsPerHour: "Requests pro Stunde",
  },
  runningSites: {
    https: "HTTPS",
    http: "HTTP",
    noTarget: "Keine Weiterleitung erkannt",
    form: "Formular",
    manual: "Manuell",
    login: "Login",
    edit: (host) => `${host} bearbeiten`,
    proxy: (upstreams) => `→ ${upstreams}`,
    files: (root) => (root ? `Dateien aus ${root}` : "Dateien"),
    redirect: (status, location) => `Umleitung (${status}) nach ${location}`,
    respond: (status) => `Feste Antwort (${status})`,
  },
  metrics: {
    title: "Metrics",
    range: "Zeitraum",
    ranges: { "24h": "24 Stunden", "7d": "7 Tage", "30d": "30 Tage" },
    host: "Host",
    allHosts: "Alle Hosts",
    requestsPerHour: "Requests pro Stunde",
    requestsPerDay: "Requests pro Tag",
    emptyTitle: "Noch keine Zugriffsdaten",
    emptyText:
      "Metriken entstehen aus Caddys Access Log. Trage in den Sites import access_log ein (siehe README).",
    tiles: {
      requests: "Requests",
      traffic: "Traffic",
      serverErrors: "Serverfehler (5xx)",
      avgTime: "Ø Antwortzeit",
      requestCount: (n) => `${n} Requests`,
      max: (value) => `max. ${value}`,
    },
    chart: {
      bar: (label, requests, errors) =>
        `${label}: ${requests} Requests, ${errors} Serverfehler`,
      requests: (n) => `${n} Requests`,
      errors: (n) => `${n} Serverfehler`,
      asTable: "Als Tabelle",
      period: "Zeitraum",
      requestsColumn: "Requests",
      errorsColumn: "Serverfehler",
      hourLabel: (label) => `${label} Uhr`,
    },
    status: {
      heading: "Statuscodes",
      empty: "Keine Requests im Zeitraum.",
      "2xx": "Erfolgreich",
      "3xx": "Umleitung",
      "4xx": "Client-Fehler",
      "5xx": "Server-Fehler",
      intro:
        "Wie sich die Antworten verteilen und wie jede Klasse und jeder Code über die Zeit verlief.",
      classesHeading: "Nach Klasse über die Zeit",
      classesNote: "Jedes Diagramm hat seine eigene Skala.",
      codesHeading: "Nach Statuscode",
      peak: (value: string) => `Spitze ${value}`,
      share: (value: string) => `${value} von allen`,
      seriesLabel: (name: string, total: string, peak: string) =>
        `${name}: ${total} Requests, Spitze ${peak} pro Zeitraum`,
      code: "Code",
      meaning: "Bedeutung",
      requests: "Requests",
      shareColumn: "Anteil",
      peakColumn: "Spitze",
      moreCodes: (n: number) =>
        n === 1
          ? "1 weiterer Code in der Tabelle"
          : `${n} weitere Codes in der Tabelle`,
    },
    hosts: {
      heading: "Hosts",
      empty: "Keine Requests im Zeitraum.",
      host: "Host",
      requests: "Requests",
      traffic: "Traffic",
      errors: "5xx",
      avgTime: "Ø Zeit",
    },
  },
  logs: {
    title: "Logs",
    filter: "Logs filtern",
    host: "Host",
    status: "Status",
    all: "Alle",
    pathContains: "Pfad enthält",
    apply: "Filtern",
    reset: "Zurücksetzen",
    noMatchTitle: "Keine passenden Einträge",
    noMatchText:
      "Für diese Filter gibt es in den letzten 14 Tagen keine Requests.",
    emptyTitle: "Noch keine Logs verfügbar",
    emptyText:
      "Hier erscheinen Caddy-Zugriffe der letzten 14 Tage, sobald das Access Log eingelesen wird (siehe README).",
    time: "Zeit",
    request: "Request",
    duration: "Dauer",
    size: "Größe",
    older: "Ältere Einträge",
  },
  settings: {
    title: "Settings",
    moreTitle: "Weitere Einstellungen folgen",
    moreText:
      "Konto und Aufbewahrungsfristen werden hier konfiguriert. Darstellung, Sprache und Abmelden findest du im Kontomenü.",
    caddy: {
      heading: "Caddy-Verbindung",
      connection: "Verbindung",
      connected: "Verbunden",
      notConfigured: "Nicht konfiguriert",
      lastSync: "Letzte erfolgreiche Synchronisierung",
      lastRevision: "Zuletzt angewendete Revision",
      running: "Laufende Konfiguration",
      matches: (n) => `Entspricht Revision #${n}`,
      differs: (n) =>
        `Entspricht nicht der zuletzt von Caddy Visualizer angewendeten Revision #${n}. Das ist kein Fehler von Caddy: Meist wurde die Caddyfile außerhalb geändert und neu geladen. Die nächste Änderung hier wendet den aktuellen Stand wieder an.`,
    },
    ingestion: {
      heading: "Access Log",
      status: "Status",
      states: {
        idle: "Startet …",
        ok: "Liest ein",
        missing: "Datei nicht gefunden",
        error: "Fehler beim Einlesen",
        passive: "Andere Instanz liest ein",
      },
      lastRun: "Letzter Lauf",
      skipped: "Übersprungene Zeilen",
      gaps: "Lücken",
      missingHelp:
        "Caddy schreibt noch kein Access Log an diese Stelle. Einrichtung: README, Abschnitt „Prepare Caddy“.",
    },
  },
  config: {
    title: "Caddy Config",
    heading: "Sites",
    intro:
      "Caddy liest seine Sites aus zwei gleichwertigen Quellen: deiner Caddyfile und den Formular-Sites. Beide bearbeitest du hier.",
    caddyfileCard: {
      title: "Caddyfile",
      text: "Sites, die du selbst schreibst, mit allem, was Caddy kann.",
      action: "Caddyfile bearbeiten",
    },
    formCard: {
      title: "Formular-Sites",
      text: "Einfache Reverse Proxies per Formular, geschrieben in sites.caddy.",
      none: "Noch keine Formular-Sites",
      count: (n, enabled) =>
        `${plural(n, "Site", "Sites")}, davon ${enabled} aktiv`,
      action: "Site hinzufügen",
    },
    siteCount: (n) => plural(n, "Site", "Sites"),
    formSitesHeading: "Formular-Sites",
    notices: {
      created: (host) => `${host} wurde angelegt.`,
      updated: (host) => `Änderungen an ${host} wurden gespeichert.`,
    },
    apply: {
      applied: "Caddy hat die Konfiguration übernommen.",
      failed:
        "Caddy hat die Konfiguration nicht übernommen und läuft mit dem vorherigen Stand weiter.",
      pending: "Ob Caddy die Konfiguration übernommen hat, wird noch geprüft.",
      notConfigured:
        "Die Caddy-Anbindung ist nicht konfiguriert, die Änderung ist nur gespeichert.",
    },
    sync: {
      synced: "Caddy synchron",
      applying: "Wird angewendet …",
      checking: "Status wird geprüft",
      failed: "Anwendung fehlgeschlagen",
      "recovery-required": "Status unklar",
      "out-of-sync": "Nicht angewendet",
      idle: "Noch nichts angewendet",
      "other-instance": "Andere Instanz aktiv",
      "not-configured": "Caddy-Anbindung nicht konfiguriert",
    },
    syncDetail: {
      appliedLine: (n, at) =>
        `Caddy läuft mit Revision #${n}${at ? `, angewendet am ${at}` : ""}.`,
      noneApplied: "Bisher wurde keine Revision erfolgreich angewendet.",
      applying:
        "Die gespeicherte Konfiguration wird gerade an Caddy übertragen.",
      checking: (n) =>
        `Für Revision #${n} fehlt noch die Bestätigung von Caddy, z. B. nach einem Neustart von Caddy Visualizer.`,
      unclear: "Das Ergebnis der letzten Anwendung ist unklar.",
      notTaken: "Caddy hat die Konfiguration nicht übernommen.",
      outOfSync:
        "Die gespeicherte Konfiguration ist noch nicht in Caddy aktiv.",
      idle: "Sobald du die Caddyfile speicherst oder eine Formular-Site anlegst, wird die Konfiguration geprüft und auf Caddy angewendet.",
      otherInstance:
        "Eine andere Instanz von Caddy Visualizer verwaltet diese Caddy-Konfiguration. Diese Instanz speichert Änderungen, wendet aber nichts an. Es darf nur eine Instanz laufen.",
      notConfigured:
        "Änderungen werden nur gespeichert, bis die Verbindung zu Caddy eingerichtet ist.",
      applyAgain: "Erneut anwenden",
      applyNow: "Jetzt anwenden",
      checkStatus: "Status prüfen",
    },
    revisionStatus: {
      pending: "Vorbereitet",
      loading: "Wird geladen",
      applied: "Angewendet",
      failed: "Fehlgeschlagen",
      "recovery-required": "Unklar",
    },
    triggers: {
      "site-created": "Site angelegt",
      "site-updated": "Site geändert",
      "site-enabled": "Site aktiviert",
      "site-disabled": "Site deaktiviert",
      "site-deleted": "Site gelöscht",
      retry: "Erneut angewendet",
      rollback: "Wiederhergestellt",
      "caddyfile-updated": "Caddyfile bearbeitet",
    },
    history: {
      heading: "Verlauf",
      text: (n) => `Die letzten ${n} Anwendungen auf Caddy`,
      lastApplied: "Zuletzt angewendet",
      rollbackTo: (n) => ` (auf #${n})`,
    },
    rollback: {
      button: "Wiederherstellen",
      title: (n) => `Revision #${n} wiederherstellen?`,
      text: (date) =>
        `Diese frühere Konfiguration vom ${date} wird wieder die aktuelle: Die Formular-Sites werden auf ihren Stand gesetzt und auf Caddy angewendet. Spätere Änderungen werden dabei ersetzt; sie bleiben im Verlauf nachvollziehbar.`,
      summary: (n, enabled) =>
        `${plural(n, "Formular-Site", "Formular-Sites")}, davon ${enabled} aktiv`,
      enabled: "aktiv",
      disabled: "deaktiviert",
      more: (n) => `und ${n} weitere`,
      none: "Keine Formular-Sites: alle Formular-Sites werden entfernt.",
      restoresMain: "Die Caddyfile wird ebenfalls auf diesen Stand gesetzt.",
      failed: "Die Revision konnte nicht wiederhergestellt werden.",
      notFound: "Diese Revision existiert nicht.",
    },
    preview: {
      heading: "Generierte Konfiguration",
      text: "sites.caddy, erzeugt aus den gespeicherten aktiven Formular-Sites. Nur zur Ansicht; an Caddy übertragen wird sie beim Anwenden.",
      ariaContent: "Inhalt von sites.caddy",
      activeSites: (n) => plural(n, "aktive Site", "aktive Sites"),
      currentStatus: "Aktueller Status",
      lastApplied: "Letzte erfolgreiche Anwendung",
      revision: (n, at) => `Revision #${n}${at ? `, ${at}` : ""}`,
      matches: " (entspricht dieser Vorschau)",
      differs: "andere Konfiguration",
    },
    list: {
      hostname: "Hostname",
      upstream: "Upstream",
      tls: "TLS",
      changed: "Geändert",
      status: "Status",
      active: "Aktiv",
      inactive: "Deaktiviert",
      activeLabel: (host) => `${host} aktiv`,
      edit: "Bearbeiten",
      editLabel: (host) => `${host} bearbeiten`,
      deleteLabel: (host) => `${host} löschen`,
      enabledNotice: (host, enabled) =>
        `${host} wurde ${enabled ? "aktiviert" : "deaktiviert"}.`,
      deletedNotice: (host) => `${host} wurde gelöscht.`,
      deleteTitle: "Site löschen?",
      deleteText:
        "wird aus den Formular-Sites entfernt. Das lässt sich nicht rückgängig machen. Um die Site nur vorübergehend abzuschalten, deaktiviere sie stattdessen.",
    },
    tls: {
      automatic: {
        short: "HTTPS automatisch",
        title: "Automatisch (HTTPS)",
        description:
          "Caddy holt ein Zertifikat und leitet HTTP auf HTTPS um. Der Hostname muss dafür öffentlich auflösbar sein.",
      },
      off: {
        short: "Nur HTTP",
        title: "HTTP",
        description:
          "Kein Zertifikat, die Site ist nur über http:// erreichbar. Für interne Dienste.",
      },
    },
    editor: {
      newTitle: "Site hinzufügen",
      newSubmit: "Site anlegen",
      editTitle: "Site bearbeiten",
      editSubmit: "Änderungen speichern",
      hostnameHint: "Die Adresse der Site, ohne http:// und ohne Pfad.",
      upstreamHint:
        "Ziel, an das Caddy die Anfragen weiterleitet: http:// oder https://, Host oder IP und optional ein Port.",
      enabled: "Aktiviert",
      enabledHint:
        "Deaktivierte Sites bleiben gespeichert, erscheinen aber nicht in der generierten Konfiguration.",
    },
    notFound: {
      title: "Site nicht gefunden",
      text: "Diese Site existiert nicht (mehr). Vielleicht wurde sie inzwischen gelöscht.",
    },
    error: {
      title: "Die Caddy-Konfiguration konnte nicht geladen werden",
      text: "Beim Laden der Sites ist ein Fehler aufgetreten. Bitte versuche es erneut.",
    },
    loading: "Sites werden geladen …",
  },
  caddyfile: {
    title: "Caddyfile",
    heading: "Caddyfile bearbeiten",
    intro:
      "Die Haupt-Caddyfile von Caddy, an ihrem Ort auf dem Server. „Prüfen“ lässt Caddy den Text validieren, ohne etwas zu ändern. „Speichern & anwenden“ lädt ihn und schreibt die Datei erst, wenn Caddy ihn übernommen hat.",
    rules:
      "Die admin-Einstellung im globalen Block und die Zeile import /config/manager/sites.caddy müssen erhalten bleiben.",
    replaced:
      "Die Caddyfile wurde auf dem Server durch eine neue Datei ersetzt (z. B. von einem Editor, der beim Speichern umbenennt). Caddy und Caddy Visualizer sehen noch die alte Fassung. Beide Container neu erstellen, bevor du hier speicherst.",
    notWritable:
      "Die Caddyfile ist für Caddy Visualizer (UID 1000) nicht beschreibbar. Prüfen geht, Speichern nicht. Siehe README, Abschnitt „Prepare Caddy“.",
    unreadable: (path) => `Die Caddyfile ${path} konnte nicht gelesen werden.`,
    content: "Inhalt der Caddyfile",
    check: "Prüfen",
    save: "Speichern & anwenden",
    dirty: "Ungespeicherte Änderungen",
    clean: "Entspricht der Datei",
    accepted: "Caddy akzeptiert die Konfiguration.",
    unchanged: " Keine Änderungen gegenüber der Datei.",
    saved: "Die Caddyfile wurde gespeichert. ",
    notSaved: "Die Caddyfile wurde nicht geändert. ",
    diffLabel: "Änderungen gegenüber der Datei",
    tooLarge: "Die Änderung ist zu groß für eine Gegenüberstellung.",
    skipped: (n) =>
      `⋯ ${plural(n, "unveränderte Zeile", "unveränderte Zeilen")}`,
    conflict:
      "Die Caddyfile wurde inzwischen an anderer Stelle geändert. Bitte lade die Seite neu; kopiere deine Eingabe vorher.",
    nothingToSave: "Keine Änderungen gegenüber der Datei.",
  },
  actions: {
    siteSaveFailed:
      "Die Site konnte nicht gespeichert werden. Bitte versuche es erneut.",
    changeFailed:
      "Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.",
    deleteFailed:
      "Die Site konnte nicht gelöscht werden. Bitte versuche es erneut.",
    siteGone: "Diese Site existiert nicht mehr. Die Liste wurde aktualisiert.",
    siteConflict:
      "Die Site wurde inzwischen von einer anderen Änderung aktualisiert. Bitte lade die Seite neu.",
  },
  codes: {
    "validation.required": "Bitte gib einen Wert ein.",
    "validation.tls": "Bitte wähle einen gültigen TLS-Modus.",
    "validation.enabled": "Ungültiger Wert für „aktiviert“.",
    "validation.invalid": "Ungültige Eingabe.",
    "hostname.required": "Bitte gib einen Hostnamen ein.",
    "hostname.scheme":
      "Bitte gib nur den Hostnamen ohne http:// oder https:// ein.",
    "hostname.whitespace": "Der Hostname darf keine Leerzeichen enthalten.",
    "hostname.path": "Der Hostname darf keinen Pfad enthalten.",
    "hostname.wildcard":
      "Wildcard-Hostnamen (*.example.com) werden noch nicht unterstützt.",
    "hostname.port": "Der Hostname darf keinen Port enthalten.",
    "hostname.tooLong": "Der Hostname darf höchstens 253 Zeichen lang sein.",
    "hostname.invalid":
      "Bitte gib einen gültigen Hostnamen ein (Buchstaben a–z, Ziffern, Bindestriche und Punkte, z. B. app.example.com).",
    "hostname.incomplete":
      "Bitte gib einen vollständigen Hostnamen mit Domain ein, z. B. app.example.com.",
    "hostname.ip":
      "IP-Adressen werden als Site-Adresse nicht unterstützt. Bitte gib einen Hostnamen ein.",
    "upstream.required":
      "Bitte gib einen Upstream ein, z. B. http://192.168.1.20:8080.",
    "upstream.characters":
      "Der Upstream darf keine Leerzeichen, Zeilenumbrüche oder Sonderzeichen außerhalb von ASCII enthalten.",
    "upstream.scheme": "Der Upstream muss mit http:// oder https:// beginnen.",
    "upstream.credentials":
      "Der Upstream darf keine Zugangsdaten (benutzer@) enthalten.",
    "upstream.path":
      "Der Upstream darf keinen Pfad, keine Query und kein Fragment enthalten.",
    "upstream.host":
      "Bitte gib einen gültigen Upstream-Host an (Hostname, IPv4- oder IPv6-Adresse).",
    "upstream.port": "Der Port muss eine Zahl zwischen 1 und 65535 sein.",
    "site.duplicate": "Für diesen Hostnamen existiert bereits eine Site.",
    "rollback.invalidSnapshot":
      "Der gespeicherte Stand dieser Revision ist ungültig und kann nicht wiederhergestellt werden.",
    "overview.previewFailed":
      "Die Vorschau konnte nicht erzeugt werden, weil gespeicherte Site-Daten ungültig sind.",
    "main.invalidPath": "Ungültiger Pfad für den Import.",
    "main.importMissing": (p: P) =>
      `Die Caddyfile muss die Zeile „import ${p.path}“ genau einmal enthalten.`,
    "main.sitesImportMissing": (p: P) =>
      `Die Caddyfile muss die Zeile „import ${p.path}“ genau einmal enthalten; dort stehen die Formular-Sites.`,
    "main.adminChanged":
      "Die admin-Einstellung im globalen Block kann hier nicht geändert werden, sonst verliert Caddy Visualizer die Verbindung zu Caddy. Ändere sie bei Bedarf per SSH.",
    "main.missing": "Der Inhalt fehlt.",
    "main.tooLarge": (p: P) => `Die Caddyfile ist größer als ${p.kib} KiB.`,
    "main.nul": "Der Inhalt enthält ein Nullbyte.",
    "apply.mainUnreadable": "Die Haupt-Caddyfile konnte nicht gelesen werden.",
    "apply.staging": "Die Konfigurationsdatei konnte nicht vorbereitet werden.",
    "apply.rejected":
      "Die Konfiguration konnte von Caddy nicht übernommen werden.",
    "apply.unreachable":
      "Caddy ist nicht erreichbar oder antwortet nicht. An der laufenden Konfiguration wurde nichts geändert.",
    "apply.notTaken":
      "Caddy hat die Konfiguration nicht übernommen und läuft mit dem vorherigen Stand weiter.",
    "apply.unknownOutcome":
      "Ob Caddy die Konfiguration übernommen hat, ist noch unklar. Der Status wird erneut geprüft.",
    "apply.ambiguous":
      "Die laufende Caddy-Konfiguration entspricht weder dieser noch der vorherigen Revision, z. B. nach einer manuellen Änderung. Bitte erneut anwenden.",
    "apply.promoteFailed":
      "Caddy hat die Konfiguration übernommen, aber die Dateien konnten nicht aktualisiert werden. Ein Neustart von Caddy würde den vorherigen Stand laden.",
    "apply.aborted":
      "Abgebrochen, bevor Caddy kontaktiert wurde (Caddy Visualizer wurde neu gestartet).",
    "apply.superseded":
      "Ergebnis nicht mehr feststellbar, inzwischen gibt es eine neuere Revision.",
    "apply.invalidSites":
      "Die gespeicherten Sites sind ungültig. Es wurde nichts an Caddy übertragen.",
    "apply.internal":
      "Beim Anwenden ist ein interner Fehler aufgetreten. An Caddy wurde nichts übertragen.",
    "apply.manualConflict": (p: P) =>
      `Der Hostname ${p.hostname} wird bereits in der Caddyfile verwendet${p.pattern === p.hostname ? "" : ` (${p.pattern})`}. Formular-Sites dürfen dortige Sites nicht überschreiben.`,
    "apply.otherInstance":
      "Eine andere Instanz von Caddy Visualizer verwaltet diese Konfiguration. Hier wurde nichts an Caddy übertragen.",
    "apply.rollbackSource":
      "Nur Revisionen, die schon einmal erfolgreich angewendet wurden, können wiederhergestellt werden.",
    "apply.mainConflict":
      "Die Caddyfile wurde inzwischen an anderer Stelle geändert. Bitte lade die Seite neu; kopiere deine Eingabe vorher.",
    "apply.mainChanged":
      "Caddy hat die Konfiguration übernommen, aber die Caddyfile wurde währenddessen an anderer Stelle geändert und deshalb nicht überschrieben.",
    "apply.duplicateAddress": (p: P) =>
      `Die Site-Adresse ${p.address} ist in der Caddy-Konfiguration bereits definiert, z. B. in der Caddyfile.`,
    "apply.notConfigured": "Die Caddy-Anbindung ist nicht konfiguriert.",
    "caddy.timeout": "Caddy hat nicht rechtzeitig geantwortet.",
    "caddy.unreachable": "Die Admin API von Caddy ist nicht erreichbar.",
    "caddy.rejected": (p: P) =>
      `Caddy hat die Anfrage abgelehnt (HTTP ${p.status}).`,
    "caddy.invalidResponse": "Caddy hat eine unerwartete Antwort geliefert.",
    "ingestion.gap":
      "Eine rotierte Logdatei war schon gelöscht; dazwischen fehlen Einträge.",
  },
};
