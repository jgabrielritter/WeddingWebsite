import { describe, it } from "node:test";
import assert from "node:assert";
import { escapeCsvValue, rowsToCsv } from "../app/lib/csv";

describe("escapeCsvValue", () => {
  it("escapes commas and quotes", () => {
    assert.equal(escapeCsvValue('Angelika, "Gabe"'), '"Angelika, ""Gabe"""');
  });

  it("returns empty for null", () => {
    assert.equal(escapeCsvValue(null), "");
  });
});

describe("rowsToCsv", () => {
  it("builds csv with headers", () => {
    const csv = rowsToCsv([{ id: 1, name: "Test" }], ["id", "name"], ["id", "name"]);
    assert.equal(csv, "id,name\n1,Test");
  });
});
