import { EventStateError } from "./errors";
import type { EventStatus } from "./model";
import type { UpdateEventInput } from "./types";
import type { UpdateProductInput } from "../products/types";
import type { UpdateStandInput } from "../stands/types";

export function assertEventMutable(status: EventStatus): void {
  if (status === "COMPLETED") {
    throw new EventStateError("A completed event cannot be modified");
  }
}

export function assertEventStillDraft(
  status: EventStatus,
  action: string
): void {
  assertEventMutable(status);
  if (status !== "DRAFT") {
    throw new EventStateError(
      `${action} is only allowed before the event starts`
    );
  }
}

function assertDraftOnlyFields(
  status: EventStatus,
  fields: ReadonlyArray<{ present: boolean; label: string }>
): void {
  assertEventMutable(status);
  const lockedField = fields.find((field) => field.present);
  if (status !== "DRAFT" && lockedField) {
    throw new EventStateError(
      `${lockedField.label} can only be changed before the event starts`
    );
  }
}

export function assertEventUpdateAllowed(
  status: EventStatus,
  patch: UpdateEventInput
): void {
  assertDraftOnlyFields(status, [
    { present: patch.name !== undefined, label: "Event name" },
    { present: patch.plannedDate !== undefined, label: "Event date" },
    {
      present: patch.baselineHoldCents !== undefined,
      label: "Card pre-authorization hold",
    },
  ]);
}

export function assertStandUpdateAllowed(
  status: EventStatus,
  patch: UpdateStandInput
): void {
  assertDraftOnlyFields(status, [
    { present: patch.standName !== undefined, label: "Stand name" },
  ]);
}

export function assertProductUpdateAllowed(
  status: EventStatus,
  patch: UpdateProductInput
): void {
  assertDraftOnlyFields(status, [
    { present: patch.productName !== undefined, label: "Product name" },
    {
      present: patch.priceIncludingTax !== undefined,
      label: "Product price",
    },
    { present: patch.taxRate !== undefined, label: "Product tax rate" },
    {
      present: patch.instantProduct !== undefined,
      label: "Product fulfillment type",
    },
  ]);
}
