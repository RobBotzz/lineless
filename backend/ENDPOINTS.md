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

| Method | URL                        | Description                                |
| ------ | -------------------------- | ------------------------------------------ |
| POST   | `/events/{eventId}/stands` | Create stand                               |
| PATCH  | `/stands/{standId}`        | Update stand                               |
| DELETE | `/stands/{standId}`        | Delete stand (soft delete via `deletedAt`) |

### Products

| Method | URL                               | Description                                  |
| ------ | --------------------------------- | -------------------------------------------- |
| POST   | `/stands/{standId}/products`      | Create product                               |
| GET    | `/products/{productId}`           | Get single product                           |
| PATCH  | `/products/{productId}`           | Update product                               |
| DELETE | `/products/{productId}`           | Delete product (soft delete via `deletedAt`) |
| POST   | `/products/{productId}/pause`     | Pause product                                |
| POST   | `/products/{productId}/terminate` | Terminate product                            |

### Event Control Center

| Method | URL                                                    | Description                                          |
| ------ | ------------------------------------------------------ | ---------------------------------------------------- |
| GET    | `/events/{eventId}/event-control-center`               | Event control center data – live KPIs and queues     |
| GET    | `/events/{eventId}/event-control-center/stream`        | Event control center data stream (SSE)               |
| GET    | `/events/{eventId}/event-control-center/orders`        | Live paid, unfulfilled orders for the control center |
| GET    | `/events/{eventId}/event-control-center/orders/stream` | Live order list stream (SSE)                         |

### Operational control (event control center)

| Method | URL                                                                                   | Description                 |
| ------ | ------------------------------------------------------------------------------------- | --------------------------- |
| POST   | `/events/{eventId}/event-control-center/orders/{orderId}/cancel`                      | Cancel all open order items |
| POST   | `/events/{eventId}/event-control-center/orders/{orderId}/items/cancel`                | Cancel selected order items |
| POST   | `/events/{eventId}/event-control-center/stands/{standId}/products/{productId}/pause`  | Pause a product             |
| POST   | `/events/{eventId}/event-control-center/stands/{standId}/products/{productId}/resume` | Resume a product            |

### Account / Payments

| Method | URL                 | Description                                |
| ------ | ------------------- | ------------------------------------------ |
| GET    | `/account/payments` | Get payment overview / financial breakdown |
| PATCH  | `/account`          | Update bank account details                |
| POST   | `/account/payments` | Trigger payout                             |

---

## Customer / Attendee

Mobile guest web app: browse, order, pay, track, rate.

### Session

| Method | URL                | Description                          |
| ------ | ------------------ | ------------------------------------ |
| POST   | `/sessions/create` | Create attendee session for an event |

### Orders

| Method | URL                         | Description                                      |
| ------ | --------------------------- | ------------------------------------------------ |
| POST   | `/orders`                   | Create order                                     |
| GET    | `/orders/{orderId}`         | Get order details (confirmation / tracking view) |
| GET    | `/orders/{orderId}/stream`  | Order status stream (SSE) – live pickup status   |
| POST   | `/orders/{orderId}/ratings` | Submit product ratings (1–5 stars + comment)     |

### Payment

| Method | URL     | Description                                           |
| ------ | ------- | ----------------------------------------------------- |
| POST   | `/tabs` | Open tab / start digital payment (redirect to Stripe) |

---

## Operator

Pickup dashboard, operator (kitchen) dashboard, cashier view.

### Authentication & onboarding

| Method | URL                        | Description                                                               |
| ------ | -------------------------- | ------------------------------------------------------------------------- |
| GET    | `/events/{eventId}/stands` | List event stands for the onboarding screen (gated by the event link key) |
| POST   | `/stands/login`            | Log into a stand (link key always; plus password for protected stands)    |

### Stand selection & dashboards

| Method | URL                               | Description                                      |
| ------ | --------------------------------- | ------------------------------------------------ |
| GET    | `/stands/{standId}/orders/stream` | Order stream for operator/pickup dashboard (SSE) |
| POST   | `/products/{productId}/pause`     | Pause product                                    |
| POST   | `/products/{productId}/terminate` | Terminate product                                |

### Order item status transitions (operator dashboard)

| Method | URL                                  | Description                                          |
| ------ | ------------------------------------ | ---------------------------------------------------- |
| POST   | `/order-items/{orderItemId}/start`   | Mark item as "In Progress" (1st tap → yellow)        |
| POST   | `/order-items/{orderItemId}/ready`   | Mark item as "Ready for pickup" (2nd tap → green)    |
| POST   | `/order-items/{orderItemId}/fulfill` | Mark item as fulfilled / picked up (3rd tap → clear) |

### Cashier (manual orders & cash payment)

| Method | URL                              | Description                       |
| ------ | -------------------------------- | --------------------------------- |
| POST   | `/orders`                        | Create manual order (cashier)     |
| POST   | `/orders/{orderId}/cash-payment` | Confirm cash payment for an order |

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
