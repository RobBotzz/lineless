# Access Matrix

| Area     | Endpoint                                                      | Public | Organizer | Operator       | Attendee      |
| -------- | ------------------------------------------------------------- | ------ | --------- | -------------- | ------------- |
| Account  | `POST /api/account/signup`                                    | yes    | no        | no             | no            |
| Account  | `POST /api/account/login`                                     | yes    | no        | no             | no            |
| Account  | `/api/account/delete`                                         | no     | yes       | no             | no            |
| Account  | `/api/account/info`                                           | no     | yes       | no             | no            |
| Account  | `/api/account/update`                                         | no     | yes       | no             | no            |
| Account  | `/api/account/password`                                       | no     | yes       | no             | no            |
| Sessions | `POST /api/sessions/create`                                   | yes    | no        | no             | no            |
| Stands   | `POST /api/stands/login`                                      | yes    | no        | no             | no            |
| Events   | `POST /api/events`                                            | no     | yes       | no             | no            |
| Events   | `GET /api/events`                                             | no     | yes       | no             | no            |
| Events   | `GET /api/events/:eventId`                                    | no     | own event | no             | session event |
| Events   | `PATCH /api/events/:eventId`                                  | no     | own event | no             | no            |
| Events   | `POST /api/events/:eventId/start`                             | no     | own event | no             | no            |
| Events   | `POST /api/events/:eventId/stop`                              | no     | own event | no             | no            |
| Events   | `POST /api/events/:eventId/operator-link/rotate`              | no     | own event | no             | no            |
| Events   | `DELETE /api/events/:eventId`                                 | no     | own event | no             | no            |
| Events   | `GET /api/events/:eventId/event-control-center`               | no     | own event | no             | no            |
| Events   | `GET /api/events/:eventId/event-control-center/stream`        | no     | own event | no             | no            |
| Events   | `GET /api/events/:eventId/event-control-center/orders`        | no     | own event | no             | no            |
| Events   | `GET /api/events/:eventId/event-control-center/orders/stream` | no     | own event | no             | no            |
| Events   | `GET /api/events/:eventId/event-control-center/settings`      | no     | own event | no             | no            |
| Events   | `PUT /api/events/:eventId/event-control-center/settings`      | no     | own event | no             | no            |
| Events   | `DELETE /api/events/:eventId/event-control-center/settings`   | no     | own event | no             | no            |
| Events   | `GET /api/events/:eventId/pickup-board`                       | no     | no        | event link key | no            |
| Events   | `GET /api/events/:eventId/pickup-board/stream`                | no     | no        | event link key | no            |
| Events   | `POST /api/events/:eventId/tabs/checkout`                     | no     | own event | no             | no            |
| Payouts  | `GET /api/payouts`                                            | no     | yes       | no             | no            |
| Payouts  | `GET /api/payouts/:eventId`                                   | no     | own event | no             | no            |
| Payouts  | `POST /api/payouts/request`                                   | no     | yes       | no             | no            |
| Orders   | `POST /api/orders`                                            | no     | no        | cashier stand  | session event |
| Orders   | `POST /api/orders/:orderId/cancel`                            | no     | own event | no             | no            |
| Orders   | `POST /api/orders/:orderId/cancel-pending-authorization`      | no     | no        | no             | own order     |
| Orders   | `POST /api/orders/:orderId/items/cancel`                      | no     | own event | no             | no            |
| Stands   | `POST /api/events/:eventId/stands`                            | no     | own event | no             | no            |
| Stands   | `GET /api/events/:eventId/stands`                             | no     | own event | event link key | session event |
| Stands   | `GET /api/stands/:standId`                                    | no     | own event | own stand      | session event |
| Stands   | `PATCH /api/stands/:standId`                                  | no     | own event | no             | no            |
| Stands   | `POST /api/stands/:standId/pause`                             | no     | own event | no             | no            |
| Stands   | `POST /api/stands/:standId/resume`                            | no     | own event | no             | no            |
| Stands   | `DELETE /api/stands/:standId`                                 | no     | own event | no             | no            |
| Products | `POST /api/stands/:standId/products`                          | no     | own event | no             | no            |
| Products | `GET /api/stands/:standId/products`                           | no     | own event | own stand      | session event |
| Products | `GET /api/products/:productId`                                | no     | own event | no             | no            |
| Products | `PATCH /api/products/:productId`                              | no     | own event | no             | no            |
| Products | `PATCH /api/products/:productId/stock`                        | no     | own event | no             | no            |
| Products | `DELETE /api/products/:productId`                             | no     | own event | no             | no            |
| Products | `POST /api/products/:productId/pause`                         | no     | own event | own stand      | no            |
| Products | `POST /api/products/:productId/resume`                        | no     | own event | own stand      | no            |
| Products | `POST /api/products/:productId/terminate`                     | no     | own event | own stand      | no            |

## Credential types

- **Organizer** — JWT (`Authorization: Bearer`), issued at account login/signup.
- **Attendee** — session id in `X-Attendee-Session-ID`, validated each request.
- **Operator** — per-stand JWT (`Authorization: Bearer`), issued at
  `POST /api/stands/login`. Scoped to a single `standId`.
- **event link key** — the secret operator-onboarding credential, sent in
  `X-Operator-Access-Key`. This is a **pre-auth gate** held by the link holder
  _before_ an operator token exists: it is stateless (no token, no session, a
  shared-secret compare against the active event). It gates stand discovery
  (`GET /api/events/:eventId/stands`) and is **always required** at
  `POST /api/stands/login` (password-protected stands need the password on top).
  Rotating the key therefore invalidates onboarding for every stand. It is never
  required on operator work routes — those rely on the operator token alone.
