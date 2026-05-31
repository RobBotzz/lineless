# Agent Prompt: Operator / Stand Authentication umsetzen

Du arbeitest im Lineless-Codebase. Setze den Operator-/Stand-Authentication-Flow wie unten beschrieben um. Lies vor Änderungen zuerst den bestehenden Code, damit du die vorhandenen Patterns beibehältst.

## Kontext zuerst lesen

Schau dir mindestens diese Dateien an:

- `Backend/src/middleware/authAccount.ts`
- `Backend/src/middleware/authAccountOrSession.ts`
- `Backend/src/middleware/authStand.ts`
- `Backend/src/types/express.d.ts`
- `Backend/src/config/config.ts`
- `Backend/src/modules/accounts/helper.ts`
- `Backend/src/modules/accounts/routes.ts`
- `Backend/src/modules/accounts/service.ts`
- `Backend/src/modules/events/model.ts`
- `Backend/src/modules/events/routes.ts`
- `Backend/src/modules/events/service.ts`
- `Backend/src/docs/openapi.ts`
- `Backend/CLAUDE.md`
- `Backend/ENDPOINTS.md`

Falls Frontend-Anpassungen Teil der Aufgabe sind, lies zusätzlich:

- `Frontend/src/auth/tokenStorage.ts`
- `Frontend/src/api/client.ts`
- `Frontend/src/router.tsx`
- `Frontend/src/routes/operator/OperatorLayout.tsx`
- `Frontend/src/routes/operator/StandSelection.tsx`
- `Frontend/src/routes/operator/Dashboard.tsx`
- `Frontend/src/routes/organizer/event-configuration/OperatorLinkPanel.tsx`

## Ziel

Implementiere einen dreistufigen Operator-Auth-Flow:

```txt
eventId
  -> nur Routing / Kontext

operatorAccessToken
  -> erlaubt Stand Selection

standToken
  -> erlaubt konkrete Stand- oder Pickup-Nutzung
```

Die `eventId` allein darf nicht reichen, um auf die Stand Selection zu kommen.

## Gewünschter Flow

### 1. Organizer erzeugt Operator-Link

Der Operator-Link soll so aussehen:

```txt
/operator/events/:eventId?access=<operatorAccessToken>
```

`eventId` ist sichtbar und nicht geheim. `operatorAccessToken` ist ein signierter JWT.

Payload-Beispiel:

```ts
{
  typ: "operator_access",
  eventId,
  purpose: "stand_selection",
  linkVersion,
  exp
}
```

Der Token soll mit einem Backend-Secret signiert werden. Nutze dafür bevorzugt ein separates Config-Feld, nicht direkt das Account-JWT-Secret, z.B.:

```ts
config.operatorAccess.secret;
config.operatorAccess.expiresIn;
```

Wenn du aus Konsistenzgründen zunächst das bestehende JWT-Setup erweiterst, dokumentiere die Entscheidung im Code knapp.

### 2. Frontend lädt Stand Selection

Frontend liest `eventId` und `access` aus der URL und ruft:

```http
GET /api/operator/events/:eventId/stands
Authorization: Bearer <operatorAccessToken>
```

Backend prüft:

- Token-Signatur gültig
- `typ === "operator_access"`
- `purpose === "stand_selection"`
- `payload.eventId === req.params.eventId`
- Token nicht abgelaufen
- `payload.linkVersion === event.operatorLinkVersion`
- Event existiert und ist nicht gelöscht

Erst dann gibt das Backend die Stand-Auswahl zurück.

Response-Beispiel:

```ts
{
  eventId,
  eventName,
  stands: [
    {
      id,
      name,
      authRequired,
      capabilities
    }
  ]
}
```

### 3. Operator wählt Stand

Für Pickup oder andere rein lesende Stände ohne Passwort:

```http
POST /api/operator/events/:eventId/stands/:standId/session
Authorization: Bearer <operatorAccessToken>
```

Für passwortgeschützte Stände:

```http
POST /api/operator/events/:eventId/stands/:standId/session
Authorization: Bearer <operatorAccessToken>
Content-Type: application/json

{
  "password": "stand-password"
}
```

Backend prüft:

- Operator-Access-Token gültig
- Stand gehört zum Event
- bei Passwort-Stand: Passwort passt zu `stand.accessPasswordHash`
- bei Pickup: Stand ist wirklich ohne Auth erlaubt

### 4. Backend erzeugt Stand-Token

Backend gibt zurück:

```ts
{
  token: ("<standToken>", standId, eventId, expiresAt);
}
```

JWT Payload:

```ts
{
  typ: "stand",
  sub: standId,
  eventId,
  capabilities: ["VIEW_ORDERS", "UPDATE_ORDER_ITEMS"],
  exp
}
```

Pickup ist eine reine Anzeige und bekommt nur:

```ts
{
  capabilities: ["VIEW_PICKUP_SCREEN"];
}
```

### 5. Frontend speichert Stand-Tokens

Stand-Tokens werden im `localStorage` gespeichert, analog zum bestehenden Organizer-Token-Pattern.

Struktur:

```ts
{
  [eventId]: {
    [standId]: "<standToken>"
  }
}
```

Dadurch kann ein Operator nach einmaliger Passwort-Eingabe schnell zwischen bereits freigeschalteten Ständen wechseln. Wenn ein Token fehlt oder abgelaufen ist, fragt das Frontend erneut nach dem Passwort oder holt bei Pickup direkt einen neuen read-only Token.

### 6. Operator-Endpunkte nutzen Stand-Token

Alle echten Operator-Aktionen laufen danach mit:

```http
Authorization: Bearer <standToken>
```

`authStand.ts` soll:

- `Authorization` Header lesen
- Bearer Token validieren
- `typ === "stand"` prüfen
- `req.stand` setzen
- bei ungültigem oder abgelaufenem Token `401` zurückgeben

Passwortprüfung gehört nicht in `authStand.ts`. Sie gehört ausschließlich in den Session-Endpunkt.

## Capabilities

Führe explizite Capabilities ein, statt nur `authRequired` zu verwenden.

Vorgeschlagener Typ:

```ts
type StandCapability =
  | "VIEW_PICKUP_SCREEN"
  | "VIEW_ORDERS"
  | "UPDATE_ORDER_ITEMS"
  | "CREATE_MANUAL_ORDER"
  | "CONFIRM_CASH_PAYMENT";
```

Beispiele:

```ts
// Pickup, reine Anzeige
["VIEW_PICKUP_SCREEN"][
  // Bar / Kitchen
  ("VIEW_ORDERS", "UPDATE_ORDER_ITEMS")
][
  // Cashier
  ("CREATE_MANUAL_ORDER", "CONFIRM_CASH_PAYMENT")
];
```

Baue kleine Helper/Middleware, um Routen später capability-basiert schützen zu können, z.B.:

```ts
requireStandCapability("UPDATE_ORDER_ITEMS");
```

## Link invalidieren

Ergänze am Event eine Version für Operator-Links:

```ts
operatorLinkVersion: number;
```

Wenn der Organizer einen neuen Operator-Link generiert:

```ts
operatorLinkVersion += 1;
```

Alte `operatorAccessToken`s sind dann ungültig.

## Zu bearbeitende Dateien

Voraussichtlich bearbeiten:

- `Backend/src/middleware/authStand.ts`
- `Backend/src/types/express.d.ts`
- `Backend/src/config/config.ts`
- `Backend/src/modules/events/model.ts`
- `Backend/src/modules/events/service.ts`
- `Backend/src/modules/events/routes.ts`
- `Backend/src/docs/openapi.ts`

Falls Frontend-Anbindung umgesetzt wird:

- `Frontend/src/router.tsx`
- `Frontend/src/routes/operator/StandSelection.tsx`
- `Frontend/src/routes/operator/Dashboard.tsx`
- `Frontend/src/routes/organizer/event-configuration/OperatorLinkPanel.tsx`
- `Frontend/src/api/client.ts` oder neue operator-spezifische API-Datei

## Neu hinzuzufügende Dateien

Voraussichtlich hinzufügen:

- `Backend/src/modules/stands/model.ts`
- `Backend/src/modules/stands/types.ts`
- `Backend/src/modules/stands/service.ts`
- `Backend/src/modules/stands/routes.ts`
- `Backend/src/modules/stands/errors.ts`
- `Backend/src/modules/operator/types.ts`
- `Backend/src/modules/operator/service.ts`
- `Backend/src/modules/operator/routes.ts`
- `Backend/src/modules/operator/helper.ts`
- optional: `Backend/src/middleware/requireStandCapability.ts`

Falls Frontend-Anbindung umgesetzt wird:

- `Frontend/src/auth/operatorTokenStorage.ts`
- `Frontend/src/api/operator.ts`

Passe die Dateiliste an, wenn im Codebase bereits passendere Orte existieren. Erfinde keine parallele Struktur, wenn vorhandene Patterns eine bessere Integration nahelegen.

## Backend API

Implementiere mindestens:

```http
GET /api/operator/events/:eventId/stands
POST /api/operator/events/:eventId/stands/:standId/session
```

Für Organizer sollte es außerdem eine Möglichkeit geben, den Link zu erzeugen oder zu rotieren, z.B.:

```http
POST /api/events/:eventId/operator-link
POST /api/events/:eventId/operator-link/rotate
```

Wenn du die genauen Endpunkte anders benennst, halte dich an die bestehenden Routing-Konventionen und dokumentiere die Entscheidung kurz.

## Datenmodell-Vorschlag

Stand:

```ts
interface StandDoc {
  _id: string;
  eventId: string;
  name: string;
  type: "KITCHEN" | "PICKUP" | "CASHIER";
  operatorAuthRequired: boolean;
  accessPasswordHash: string | null;
  capabilities: StandCapability[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

Event-Erweiterung:

```ts
operatorLinkVersion: number;
```

## Best Practices

- Nutze JWT analog zu `authAccount.ts`, aber mit eigenem Payload-Typ für Operator-Access und Stand-Token.
- Verwende bcrypt für Stand-Passwörter. Wiederverwende bestehende Helper, wenn passend.
- Speichere Stand-Passwörter nie im Klartext.
- `eventId` ist kein Secret und darf nie alleine Autorisierung bedeuten.
- `operatorAccessToken` erlaubt nur Stand Selection und Stand-Session-Erstellung, keine Order-Aktionen.
- `standToken` ist immer auf genau einen Stand begrenzt.
- Pickup ist ohne Passwort erlaubt, aber nur als reine Anzeige mit `VIEW_PICKUP_SCREEN`.
- Prüfe immer, dass `stand.eventId === eventId`.
- Nutze kurze Token-Laufzeiten für Stand-Tokens, z.B. `12h`.
- Baue Fehlerantworten konsistent zu bestehenden Routen: `401` für fehlende/ungültige Auth, `403` für fehlende Berechtigung, `404` für nicht gefundene Ressourcen, `409` für ungültige Zustände.
- Ergänze OpenAPI-Erkennung/Security Schemes, wenn neue Middleware oder Routen hinzukommen.
- Halte Änderungen eng am bestehenden Stil: Express Router, Zod Validation, Service Layer, Mongoose Models.
- Keine Cookies für Operator-Auth verwenden. Das gewünschte Pattern ist Bearer Token + `localStorage`, analog Organizer-Auth.

## Code Guidelines

- TypeScript strikt typisieren. Keine unnötigen `any`.
- Kleine, fokussierte Helper-Funktionen für Token-Erzeugung und Token-Prüfung.
- Token-Payloads explizit typisieren:

```ts
interface OperatorAccessTokenPayload {
  typ: "operator_access";
  eventId: string;
  purpose: "stand_selection";
  linkVersion: number;
}

interface StandTokenPayload {
  typ: "stand";
  sub: string;
  eventId: string;
  capabilities: StandCapability[];
}
```

- JWT `exp` muss über `jwt.sign(..., { expiresIn })` gesetzt werden.
- Keine Passwortprüfung in Middleware.
- Keine Business-Logik in Routes, soweit der bestehende Code dafür Services nutzt.
- Kommentare nur dort, wo sie Sicherheitsentscheidungen oder nicht offensichtliche Token-Grenzen erklären.

## Tests / Verification

Prüfe nach der Umsetzung mindestens:

- TypeScript Build / Tests laufen.
- Ohne `operatorAccessToken` ist Stand Selection `401`.
- Mit manipulierter `eventId` im Token ist Stand Selection `401`.
- Mit alter `operatorLinkVersion` ist Stand Selection `401`.
- Pickup erzeugt ohne Passwort einen Stand-Token mit nur `VIEW_PICKUP_SCREEN`.
- Passwortgeschützter Stand lehnt falsches Passwort ab.
- Passwortgeschützter Stand erzeugt bei richtigem Passwort einen Stand-Token.
- `authStand.ts` akzeptiert nur `typ: "stand"`, nicht `typ: "operator_access"`.
- Capability-Middleware gibt `403`, wenn Capability fehlt.
- Ergänze Bruno API Tests unter `Backend/tests` für die neuen Operator-/Stand-Auth-Endpunkte.
- Orientiere dich dabei an den bestehenden Bruno-Dateien in `Backend/tests/bruno`.
- Decke in Bruno mindestens Happy Path, fehlenden Access Token, falsches Stand-Passwort und Pickup ohne Passwort ab.

## Ergebnis

Am Ende soll ein Operator-Link nicht allein über Kenntnis der `eventId` funktionieren. Die Stand Selection braucht den signierten `operatorAccessToken`. Konkrete Stand-Nutzung braucht danach einen eigenen `standToken`, der im Frontend pro Event und Stand im `localStorage` gespeichert wird.
