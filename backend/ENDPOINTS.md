# Lineless – API Endpoints (by Persona)

Endpoints to implement, grouped by the persona / view that needs them.
Some endpoints are needed by more than one persona (e.g. reading the product catalog).
These are marked as **Shared** at the bottom.

---

## Organizer

Admin dashboard, event configuration, event control center, payout management.

### Events

| Method | URL                                      | Description                                              |
| ------ | ---------------------------------------- | -------------------------------------------------------- |
| POST   | `/events`                                | Create event                                             |
| GET    | `/events`                                | Get all events (dashboard)                               |
| GET    | `/events/{eventId}`                      | Get single event (configuration page)                    |
| PATCH  | `/events/{eventId}`                      | Update event (name, date, location, ratings toggle, ...) |
| POST   | `/events/{eventId}/start`                | Start event (activate pay-per-use billing)               |
| POST   | `/events/{eventId}/stop`                 | Stop event                                               |
| POST   | `/events/{eventId}/operator-link/rotate` | Rotate the operator link key (invalidate old links)      |
| DELETE | `/events/{eventId}`                      | Delete event (soft delete via `deletedAt`)               |

### Stands

| Method | URL                                      | Description                                            |
| ------ | ---------------------------------------- | ------------------------------------------------------ |
| POST   | `/events/{eventId}/stands`               | Create stand                                           |
| GET    | `/events/{eventId}/stands/cashier-stand` | Get the event's cashier stand (organizer / event link) |
| PATCH  | `/stands/{standId}`                      | Update stand                                           |
| POST   | `/stands/{standId}/pause`                | Pause stand                                            |
| POST   | `/stands/{standId}/resume`               | Resume stand                                           |
| DELETE | `/stands/{standId}`                      | Delete stand (soft delete via `deletedAt`)             |

### Products

| Method | URL                            | Description                                             |
| ------ | ------------------------------ | ------------------------------------------------------- |
| POST   | `/stands/{standId}/products`   | Create product                                          |
| GET    | `/products/{productId}`        | Get single product                                      |
| PATCH  | `/products/{productId}`        | Update product metadata                                 |
| PATCH  | `/products/{productId}/stock`  | Compare-and-set product stock                           |
| DELETE | `/products/{productId}`        | Delete product (soft delete via `deletedAt`)            |
| POST   | `/products/{productId}/pause`  | Pause product                                           |
| POST   | `/products/{productId}/resume` | Resume product                                          |
| PUT    | `/products/{productId}/image`  | Upload/replace product image (multipart, field `image`) |
| DELETE | `/products/{productId}/image`  | Remove the uploaded product image                       |
| GET    | `/products/{productId}/image`  | Serve product image bytes (public, cached)              |

### Event Control Center

| Method | URL                                                    | Description                                                 |
| ------ | ------------------------------------------------------ | ----------------------------------------------------------- |
| GET    | `/events/{eventId}/event-control-center`               | Event control center data – live KPIs and queues            |
| GET    | `/events/{eventId}/event-control-center/stream`        | Event control center data stream (SSE)                      |
| GET    | `/events/{eventId}/event-control-center/orders`        | Latest live paid, unfulfilled orders for the control center |
| GET    | `/events/{eventId}/event-control-center/orders/stream` | Live order list stream (SSE)                                |
| GET    | `/events/{eventId}/event-control-center/settings`      | Get effective alert thresholds                              |
| PUT    | `/events/{eventId}/event-control-center/settings`      | Replace alert thresholds                                    |
| DELETE | `/events/{eventId}/event-control-center/settings`      | Reset alert thresholds to defaults                          |

### Account / Payments

| Method | URL                               | Description                                                      |
| ------ | --------------------------------- | ---------------------------------------------------------------- |
| PATCH  | `/account/update`                 | Update bank account details (IBAN, holder name)                  |
| GET    | `/payouts`                        | Payout overview: bank details, per-event summary, payout history |
| GET    | `/payouts/{eventId}`              | Full payout breakdown for one event                              |
| POST   | `/payouts/request`                | Record a payout request for the currently available revenue      |
| POST   | `/events/{eventId}/tabs/checkout` | Charge all ready tabs for an event (bulk settle online payments) |

---

## Customer / Attendee

Mobile guest web app: browse, order, pay, track, rate.

### Session

| Method | URL                | Description                          |
| ------ | ------------------ | ------------------------------------ |
| POST   | `/sessions/create` | Create attendee session for an event |

### Orders

| Method | URL                                              | Description                                                           |
| ------ | ------------------------------------------------ | --------------------------------------------------------------------- |
| POST   | `/orders`                                        | Idempotently create order and reserve available stock                 |
| GET    | `/orders`                                        | List attendee's own paid orders                                       |
| GET    | `/orders/{orderId}`                              | Get order details (confirmation / tracking view)                      |
| GET    | `/orders/stream`                                 | Attendee's live order feed over SSE — session-wide snapshot + updates |
| POST   | `/orders/{orderId}/cancel`                       | Organizer cancels all open order items                                |
| POST   | `/orders/{orderId}/cancel-pending-authorization` | Idempotently abandons a card order awaiting additional authorization  |
| POST   | `/orders/{orderId}/items/cancel`                 | Organizer cancels selected order items                                |

`POST /orders` requires a client-generated UUID `requestId`. If stock is
insufficient, the full request is rejected with `409 INSUFFICIENT_STOCK` and no
partial reservation is kept. Replaying the `requestId` of a soft-deleted order
returns `409 ORDER_REQUEST_DELETED`; replaying a fully cancelled or released
order returns `409 ORDER_REQUEST_CANCELLED`. `PATCH /products/{productId}/stock` requires both
`stockMode`, `productStock`, `expectedStockMode`, and `expectedProductStock`.
`UNLIMITED` products are not reserved or included in low-stock alerts. Products
without a stored `stockMode` are treated as `UNLIMITED` for backward
compatibility. A stale expected mode or value returns `409 STOCK_CHANGED`.

### Payment

| Method | URL                      | Description                                              |
| ------ | ------------------------ | -------------------------------------------------------- |
| POST   | `/tabs`                  | Open tab / start digital payment                         |
| POST   | `/tabs/{tabId}/checkout` | Capture all authorized payments and mark tab as paid     |
| POST   | `/webhooks/stripe`       | Stripe webhook receiver (signature-verified, idempotent) |

---

## Operator

Pickup dashboard, operator (kitchen) dashboard, cashier view.

### Authentication & onboarding

| Method | URL                        | Description                                                               |
| ------ | -------------------------- | ------------------------------------------------------------------------- |
| GET    | `/events/{eventId}/stands` | List event stands for the onboarding screen (gated by the event link key) |
| POST   | `/stands/login`            | Log into a stand (link key always; plus password for protected stands)    |

### Stand selection & dashboards

| Method | URL                                     | Description                                                       |
| ------ | --------------------------------------- | ----------------------------------------------------------------- |
| GET    | `/events/{eventId}/pickup-board`        | Event-wide read-only pickup monitor (gated by the event link key) |
| GET    | `/events/{eventId}/pickup-board/stream` | Live event-wide pickup monitor stream (SSE, event link key)       |
| GET    | `/operator/board`                       | Current stand operator board snapshot                             |
| GET    | `/operator/board/stream`                | Live stand operator board stream (SSE)                            |
| POST   | `/products/{productId}/pause`           | Pause product                                                     |

### Order item status transitions (operator dashboard)

| Method | URL                                  | Description                                          |
| ------ | ------------------------------------ | ---------------------------------------------------- |
| POST   | `/order-items/{orderItemId}/start`   | Mark item as "In Progress" (1st tap → yellow)        |
| POST   | `/order-items/{orderItemId}/ready`   | Mark item as "Ready for pickup" (2nd tap → green)    |
| POST   | `/order-items/{orderItemId}/fulfill` | Mark item as fulfilled / picked up (3rd tap → clear) |

### Cashier (manual orders & cash payment)

| Method | URL                              | Description                                              |
| ------ | -------------------------------- | -------------------------------------------------------- |
| POST   | `/orders`                        | Create manual order (cashier)                            |
| POST   | `/orders/{orderId}/cash-payment` | Confirm cash received — marks order paid, releases items |

---

## Shared (used by multiple personas)

| Method | URL                              | Description                                                      | Used by                       |
| ------ | -------------------------------- | ---------------------------------------------------------------- | ----------------------------- |
| GET    | `/stands/{standId}`              | Get single stand                                                 | Organizer, Operator, Customer |
| GET    | `/events/{eventId}/stands`       | List stands of an event                                          | Organizer, Customer           |
| GET    | `/stands/{standId}/products`     | List products of a stand (menu / catalog)                        | Organizer, Operator, Customer |
| POST   | `/orders`                        | Create order (customer app and cashier both use this)            | Customer, Operator            |
| POST   | `/orders/{orderId}/cash-payment` | Cash payment (operator confirms, applies to customer orders too) | Operator                      |

> Note: `POST /orders` and `POST /orders/{orderId}/cash-payment` are listed under both
> Customer/Operator sections for clarity but are the same endpoints.

---
