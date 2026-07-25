import { z } from "zod";
import type { NormalizedRow, InvalidRow, NormalizeResult } from "./csvImport";

// IndMoney's Account Aggregator "All Transactions" screen ships this exact
// shape (undocumented internal API, copied from the app/website's network
// tab) - grouped by calendar day, each day's `transaction_date` carries the
// year (e.g. "Jul 24, 2026") so it parses unambiguously, unlike the
// slash-separated dates in bank CSV exports. `.passthrough()` everywhere
// since this is someone else's internal API that can add fields any time;
// we only care about a handful of them.
const eventPropsSchema = z
  .object({
    transaction_type: z.enum(["DEBIT", "CREDIT"]).optional(),
    transaction_value: z.number().optional(),
    transaction_title: z.string().optional(),
  })
  .passthrough();

const txnEntrySchema = z
  .object({
    middle: z.object({ title: z.string().optional() }).passthrough().optional(),
    right: z
      .object({
        title: z.string().optional(),
        image_url: z.string().optional(),
        event_details: z
          .object({ event_props: eventPropsSchema.optional() })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const dayGroupSchema = z
  .object({
    transaction_date: z.string(),
    list: z.array(txnEntrySchema),
  })
  .passthrough();

const payloadSchema = z
  .object({
    data: z
      .object({
        transaction_list: z.array(dayGroupSchema),
      })
      .passthrough(),
  })
  .passthrough();

// The per-transaction event_props.transaction_date has no year and has been
// observed to occasionally disagree with the day-group it's nested under
// (an IndMoney data quirk, not a bug here) - the day-group header is what
// the transaction is actually filed under in their own UI, so it's the
// source of truth for the date rather than the per-transaction field.
export function parseIndmoneyPayload(raw: string): NormalizeResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("That doesn't look like valid JSON.");
  }

  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("This doesn't look like an IndMoney transactions export (missing data.transaction_list).");
  }

  const rows: NormalizedRow[] = [];
  const invalid: InvalidRow[] = [];
  let rowIndex = 0;

  for (const group of parsed.data.data.transaction_list) {
    const dateISO = new Date(group.transaction_date).toISOString();
    const dateValid = !Number.isNaN(new Date(group.transaction_date).getTime());

    for (const entry of group.list) {
      const props = entry.right?.event_details?.event_props;
      const description = (props?.transaction_title ?? entry.middle?.title ?? "").trim();

      let amount: number | null = null;
      if (props?.transaction_value != null && props?.transaction_type) {
        amount = props.transaction_type === "CREDIT" ? props.transaction_value : -props.transaction_value;
      } else if (entry.right?.title) {
        // Fallback for entries missing event_props: parse "₹16,494" and infer
        // direction from which icon is shown next to the amount.
        const magnitude = parseFloat(entry.right.title.replace(/[₹,\s]/g, ""));
        if (Number.isFinite(magnitude)) {
          amount = entry.right.image_url?.includes("credit-icon") ? magnitude : -magnitude;
        }
      }

      if (!dateValid) {
        invalid.push({ rowIndex, reason: "invalid_date", dateRaw: group.transaction_date, descriptionRaw: description });
      } else if (!description) {
        invalid.push({ rowIndex, reason: "missing_description", dateRaw: group.transaction_date, descriptionRaw: description });
      } else if (amount === null) {
        invalid.push({ rowIndex, reason: "invalid_amount", dateRaw: group.transaction_date, descriptionRaw: description });
      } else {
        rows.push({ dateISO, description, amount });
      }
      rowIndex++;
    }
  }

  return { rows, invalid };
}
