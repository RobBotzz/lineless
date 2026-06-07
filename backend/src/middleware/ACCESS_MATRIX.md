# Access Matrix

| Area     | Endpoint                                  | Public | Organizer | Operator  | Attendee      |
| -------- | ----------------------------------------- | ------ | --------- | --------- | ------------- |
| Account  | `POST /api/account/signup`                | yes    | no        | no        | no            |
| Account  | `POST /api/account/login`                 | yes    | no        | no        | no            |
| Account  | `/api/account/delete`                     | no     | yes       | no        | no            |
| Account  | `/api/account/info`                       | no     | yes       | no        | no            |
| Account  | `/api/account/update`                     | no     | yes       | no        | no            |
| Account  | `/api/account/password`                   | no     | yes       | no        | no            |
| Sessions | `POST /api/sessions/create`               | yes    | no        | no        | no            |
| Stands   | `POST /api/stands/login`                  | yes    | no        | no        | no            |
| Events   | `POST /api/events`                        | no     | yes       | no        | no            |
| Events   | `GET /api/events`                         | no     | yes       | no        | no            |
| Events   | `GET /api/events/:eventId`                | no     | own event | no        | session event |
| Events   | `PATCH /api/events/:eventId`              | no     | own event | no        | no            |
| Events   | `POST /api/events/:eventId/start`         | no     | own event | no        | no            |
| Events   | `POST /api/events/:eventId/stop`          | no     | own event | no        | no            |
| Events   | `DELETE /api/events/:eventId`             | no     | own event | no        | no            |
| Stands   | `POST /api/events/:eventId/stands`        | no     | own event | no        | no            |
| Stands   | `GET /api/events/:eventId/stands`         | no     | own event | no        | session event |
| Stands   | `GET /api/stands/:standId`                | no     | own event | own stand | session event |
| Stands   | `PATCH /api/stands/:standId`              | no     | own event | no        | no            |
| Stands   | `DELETE /api/stands/:standId`             | no     | own event | no        | no            |
| Products | `POST /api/stands/:standId/products`      | no     | own event | no        | no            |
| Products | `GET /api/stands/:standId/products`       | no     | own event | own stand | session event |
| Products | `GET /api/products/:productId`            | no     | own event | no        | no            |
| Products | `PATCH /api/products/:productId`          | no     | own event | no        | no            |
| Products | `DELETE /api/products/:productId`         | no     | own event | no        | no            |
| Products | `POST /api/products/:productId/pause`     | no     | own event | own stand | no            |
| Products | `POST /api/products/:productId/terminate` | no     | own event | own stand | no            |
