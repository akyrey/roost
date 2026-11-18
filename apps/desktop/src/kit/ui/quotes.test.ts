import { hasTypographicQuotes, straightenQuotes } from "./quotes";

describe("typographic quotes", () => {
  it("finds and straightens smart quotes", () => {
    const typed = 'connector_class=“Connector" AND name = ‘x’';

    expect(hasTypographicQuotes(typed)).toBe(true);
    expect(straightenQuotes(typed)).toBe("connector_class=\"Connector\" AND name = 'x'");
    expect(hasTypographicQuotes("name = 'x'")).toBe(false);
  });
});
