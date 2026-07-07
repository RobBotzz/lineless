import assert from "node:assert/strict";
import test from "node:test";
import { EventStateError } from "./errors";
import {
  assertEventMutable,
  assertEventStillDraft,
  assertEventUpdateAllowed,
  assertProductUpdateAllowed,
  assertStandUpdateAllowed,
} from "./mutationPolicy";
import type { EventStatus } from "./model";

const nonTerminalStatuses: EventStatus[] = ["DRAFT", "ACTIVE", "STOPPED"];

void test("non-completed events remain mutable", () => {
  for (const status of nonTerminalStatuses) {
    assert.doesNotThrow(() => assertEventMutable(status));
  }
});

void test("completed events reject every mutation", () => {
  assert.throws(
    () => assertEventMutable("COMPLETED"),
    (error) =>
      error instanceof EventStateError &&
      error.message === "A completed event cannot be modified"
  );
});

void test("draft-only actions remain permanently locked after start", () => {
  const actions = [
    "Stand creation",
    "Stand deletion",
    "Product creation",
    "Product deletion",
  ];
  for (const action of actions) {
    assert.doesNotThrow(() => assertEventStillDraft("DRAFT", action));
    for (const status of ["ACTIVE", "STOPPED"] as const) {
      assert.throws(
        () => assertEventStillDraft(status, action),
        (error) =>
          error instanceof EventStateError &&
          error.message === `${action} is only allowed before the event starts`
      );
    }
  }
});

void test("draft patches allow all event, stand, and product setup fields", () => {
  assert.doesNotThrow(() =>
    assertEventUpdateAllowed("DRAFT", {
      name: "Updated event",
      plannedDate: new Date(),
      baselineHoldCents: 2000,
      ratingsEnabled: true,
      cashierEnabled: false,
      branding: { primaryColor: "#112233" },
      location: {
        locationName: "New location",
        xCoordinate: 1,
        yCoordinate: 2,
      },
    })
  );
  assert.doesNotThrow(() =>
    assertStandUpdateAllowed("DRAFT", {
      standName: "Updated stand",
      accessPassword: "secret",
      location: {
        locationName: "Stand location",
        xCoordinate: 1,
        yCoordinate: 2,
      },
    })
  );
  assert.doesNotThrow(() =>
    assertProductUpdateAllowed("DRAFT", {
      productName: "Updated product",
      productDescription: "Updated description",
      priceIncludingTax: 500,
      taxRate: 1900,
      instantProduct: true,
    })
  );
});

void test("post-start event patches allow live fields and reject every locked field", () => {
  for (const status of ["ACTIVE", "STOPPED"] as const) {
    assert.doesNotThrow(() =>
      assertEventUpdateAllowed(status, {
        ratingsEnabled: true,
        cashierEnabled: false,
        branding: { accentTextColor: null },
        location: {
          locationName: "Updated location",
          xCoordinate: 1,
          yCoordinate: 2,
        },
      })
    );
    for (const patch of [
      { name: "Locked" },
      { plannedDate: new Date() },
      { baselineHoldCents: 2000 },
    ]) {
      assert.throws(
        () => assertEventUpdateAllowed(status, patch),
        EventStateError
      );
    }
  }
});

void test("post-start stand patches allow operations and reject renaming", () => {
  for (const status of ["ACTIVE", "STOPPED"] as const) {
    assert.doesNotThrow(() =>
      assertStandUpdateAllowed(status, {
        accessPassword: null,
        location: {
          locationName: "Updated location",
          xCoordinate: 1,
          yCoordinate: 2,
        },
      })
    );
    assert.throws(
      () => assertStandUpdateAllowed(status, { standName: "Locked" }),
      EventStateError
    );
  }
});

void test("post-start product patches allow descriptions and reject every locked field", () => {
  for (const status of ["ACTIVE", "STOPPED"] as const) {
    assert.doesNotThrow(() =>
      assertProductUpdateAllowed(status, {
        productDescription: "Updated description",
      })
    );
    for (const patch of [
      { productName: "Locked" },
      { priceIncludingTax: 500 },
      { taxRate: 1900 },
      { instantProduct: true },
    ]) {
      assert.throws(
        () => assertProductUpdateAllowed(status, patch),
        EventStateError
      );
    }
  }
});

void test("completed patches reject fields that are live-safe before completion", () => {
  assert.throws(
    () => assertEventUpdateAllowed("COMPLETED", { ratingsEnabled: true }),
    EventStateError
  );
  assert.throws(
    () => assertStandUpdateAllowed("COMPLETED", { accessPassword: null }),
    EventStateError
  );
  assert.throws(
    () =>
      assertProductUpdateAllowed("COMPLETED", {
        productDescription: "Locked",
      }),
    EventStateError
  );
});
