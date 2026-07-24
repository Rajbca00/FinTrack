import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";

export type ParsedSearch = {
  text: string;
  from?: string;
  to?: string;
  minAmount?: number;
  maxAmount?: number;
  // Human-readable description of what was recognized, e.g. "last month",
  // "above ₹1,000" - shown back to the user so parsing never feels silent.
  recognized: string[];
};

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function monthRange(year: number, monthIndex: number) {
  const d = new Date(Date.UTC(year, monthIndex, 1));
  return { from: startOfMonth(d), to: endOfMonth(d) };
}

// Turns a free-text query like "fuel last month" or "groceries above 1000"
// into a date range + amount threshold + remaining free-text terms, so the
// existing account/group/category filters and this parsed intent can be
// combined rather than one replacing the other. Deliberately simple
// (keyword + regex matching, not a real NLP pipeline) - it only needs to
// cover the phrasing patterns in the spec, not arbitrary English.
export function parseSearchQuery(raw: string, now = new Date()): ParsedSearch {
  let text = ` ${raw.toLowerCase().trim()} `;
  const recognized: string[] = [];
  let from: Date | undefined;
  let to: Date | undefined;
  let minAmount: number | undefined;
  let maxAmount: number | undefined;

  const consume = (re: RegExp, label: string | ((m: RegExpMatchArray) => string)) => {
    const match = text.match(re);
    if (match) {
      text = text.replace(re, " ");
      recognized.push(typeof label === "function" ? label(match) : label);
    }
    return match;
  };

  consume(/\bthis month\b/, () => {
    const r = monthRange(now.getFullYear(), now.getMonth());
    from = r.from;
    to = r.to;
    return "this month";
  });
  consume(/\blast month\b/, () => {
    const prev = subMonths(now, 1);
    const r = monthRange(prev.getFullYear(), prev.getMonth());
    from = r.from;
    to = r.to;
    return "last month";
  });
  consume(/\bthis year\b/, () => {
    from = startOfYear(now);
    to = endOfYear(now);
    return "this year";
  });
  consume(/\blast year\b/, () => {
    from = startOfYear(new Date(now.getFullYear() - 1, 0, 1));
    to = endOfYear(new Date(now.getFullYear() - 1, 0, 1));
    return "last year";
  });

  if (!from && !to) {
    const monthPattern = new RegExp(`\\b(${MONTH_NAMES.join("|")})(?:\\s+(\\d{4}))?\\b`);
    consume(monthPattern, (m) => {
      const monthIndex = MONTH_NAMES.indexOf(m[1]);
      const year = m[2] ? Number(m[2]) : now.getFullYear();
      const r = monthRange(year, monthIndex);
      from = r.from;
      to = r.to;
      return m[2] ? `${m[1]} ${m[2]}` : m[1];
    });
  }

  consume(/\b(?:above|over|more than|greater than)\s+(\d+(?:\.\d+)?)\b/, (m) => {
    minAmount = Number(m[1]);
    return `above ${m[1]}`;
  });
  consume(/\b(?:below|under|less than)\s+(\d+(?:\.\d+)?)\b/, (m) => {
    maxAmount = Number(m[1]);
    return `below ${m[1]}`;
  });

  return {
    text: text.trim().replace(/\s+/g, " "),
    from: from?.toISOString(),
    to: to?.toISOString(),
    minAmount,
    maxAmount,
    recognized,
  };
}
