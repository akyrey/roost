import { filterByQuery, matchScore } from "./match";

describe("palette matching", () => {
  it("ranks prefixes, then word starts, then substrings, then scattered letters", () => {
    expect(matchScore("new", "New tab")).toBe(0);
    expect(matchScore("tab", "New tab")).toBe(1);
    expect(matchScore("ab", "New tab")).toBe(2);
    expect(matchScore("nt", "New tab")).toBe(3);
    expect(matchScore("xyz", "New tab")).toBeNull();
    expect(matchScore("  ", "anything")).toBe(0);
  });

  it("orders by score and keeps the given order among equals", () => {
    const items = ["orders", "customer_orders", "order_items", "people"];
    expect(filterByQuery(items, "order", (s) => s)).toEqual([
      "orders",
      "order_items",
      "customer_orders",
    ]);
  });
});
