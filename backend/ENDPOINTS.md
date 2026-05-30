# Lineless – API Endpoints (by Persona)

Endpoints to implement, grouped by the persona / view that needs them.
Some endpoints are needed by more than one persona (e.g. reading the product catalog).
These are marked as **Shared** at the bottom.

---

## Organizer

Admin dashboard, event configuration, analytics, payout management.

### Events

| Method | URL                       | Description                                              |
| ------ | ------------------------- | -------------------------------------------------------- |
| POST   | `/events`                 | Create event                                             |
| GET    | `/events`                 | Get all events (dashboard)                               |
| GET    | `/events/{eventId}`       | Get single event (configuration page)                    |
| PATCH  | `/events/{eventId}`       | Update event (name, date, location, ratings toggle, ...) |
| POST   | `/events/{eventId}/start` | Start event (activate pay-per-use billing)               |
| POST   | `/events/{eventId}/stop`  | Stop event                                               |
| DELETE | `/events/{eventId}`       | Delete event (soft delete via `deletedAt`)               |

### Stands

| Method | URL                        | Description                                |
| ------ | -------------------------- | ------------------------------------------ |
| POST   | `/events/{eventId}/stands` | Create stand                               |
| PATCH  | `/stands/{standId}`        | Update stand                               |
| DELETE | `/stands/{standId}`        | Delete stand (soft delete via `deletedAt`) |

### Products

| Method | URL                          | Description                                  |
| ------ | ---------------------------- | -------------------------------------------- |
| POST   | `/stands/{standId}/products` | Create product                               |
| PATCH  | `/products/{productId}`      | Update product                               |
| DELETE | `/products/{productId}`      | Delete product (soft delete via `deletedAt`) |

### Analytics

| Method | URL                           | Description                                        |
| ------ | ----------------------------- | -------------------------------------------------- |
| GET    | `/analytics/{eventId}/stream` | Analytics stream (SSE) – live KPIs, sales, ratings |

### Operational control (analytics dashboard)

| Method                      | URL                        | Description                         |
| --------------------------- | -------------------------- | ----------------------------------- | --------------------------- |
| POST                        | `/stands/{standId}/pause`  | Pause a stand's queue               |
| POST                        | `/stands/{standId}/resume` | Resume a stand's queue              |
| UNSURE - PLEASE DISCUSS/ -> | POST                       | `/order-items/{orderItemId}/cancel` | Cancel a pending order item |

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

| Method | URL              | Description                            |
| ------ | ---------------- | -------------------------------------- |
| POST   | `/users/session` | Create user session (stored as cookie) |

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

### Stand selection & dashboards

| Method | URL                               | Description                                      |
| ------ | --------------------------------- | ------------------------------------------------ |
| GET    | `/stands/{standId}/orders/stream` | Order stream for operator/pickup dashboard (SSE) |

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
| GET    | `/stands/{standId}`              | Get single stand                                                 | Organizer, Operator           |
| GET    | `/events/{eventId}/stands`       | List stands of an event                                          | Organizer, Operator, Customer |
| GET    | `/stands/{standId}/products`     | List products of a stand (menu / catalog)                        | Customer, Operator            |
| POST   | `/orders`                        | Create order (customer app and cashier both use this)            | Customer, Operator            |
| POST   | `/orders/{orderId}/cash-payment` | Cash payment (operator confirms, applies to customer orders too) | Operator                      |

> Note: `POST /orders` and `POST /orders/{orderId}/cash-payment` are listed under both
> Customer/Operator sections for clarity but are the same endpoints.

---
