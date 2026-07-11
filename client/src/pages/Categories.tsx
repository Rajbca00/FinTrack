import { useState } from "react";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useRules,
  useCreateRule,
  useDeleteRule,
  useUpdateRule,
  useApplyRules,
} from "../hooks/useApi";
import { Card, Button, Modal, Input, Select, Label, Badge } from "../components/ui";
import type { AmountSign, CategoryType, MatchType } from "../lib/api";

export function Categories() {
  const { data: categories } = useCategories();
  const { data: rules } = useRules();
  const deleteCategory = useDeleteCategory();
  const deleteRule = useDeleteRule();
  const updateRule = useUpdateRule();
  const applyRules = useApplyRules();
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Categories</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Custom categories used to classify income and expenses.</p>
          </div>
          <Button onClick={() => setShowAddCategory(true)}>+ Add category</Button>
        </div>
        <Card>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {categories?.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800">
                <Badge color={c.color}>{c.name}</Badge>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{c.type.toLowerCase()}</span>
                  {!c.isSystem && (c._count?.transactions ?? 0) === 0 && (
                    <button className="hover:text-red-500" onClick={() => deleteCategory.mutate(c.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Auto-categorization rules</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Rules run in priority order (highest first) whenever a transaction is imported or manually added.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => applyRules.mutate({ overwrite: false })} disabled={applyRules.isPending}>
              Apply to uncategorized
            </Button>
            <Button onClick={() => setShowAddRule(true)}>+ Add rule</Button>
          </div>
        </div>
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">Pattern</th>
                <th className="px-4 py-2 font-medium">Match</th>
                <th className="px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Priority</th>
                <th className="px-4 py-2 font-medium">Active</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rules?.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-mono text-xs">{r.pattern}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">{r.matchType}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">{r.amountSign}</td>
                  <td className="px-4 py-2">
                    <Badge color={r.category?.color}>{r.category?.name}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">{r.priority}</td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={r.isActive}
                      onChange={(e) => updateRule.mutate({ id: r.id, data: { isActive: e.target.checked } })}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button className="text-xs text-slate-400 hover:text-red-500" onClick={() => deleteRule.mutate(r.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(rules?.length ?? 0) === 0 && <p className="p-6 text-center text-sm text-slate-500">No rules yet.</p>}
        </Card>
      </div>

      {showAddCategory && <AddCategoryModal onClose={() => setShowAddCategory(false)} />}
      {showAddRule && <AddRuleModal onClose={() => setShowAddRule(false)} />}
    </div>
  );
}

function AddCategoryModal({ onClose }: { onClose: () => void }) {
  const createCategory = useCreateCategory();
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("EXPENSE");
  const [color, setColor] = useState("#2a78d6");

  return (
    <Modal title="Add category" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Pet Care" />
        </div>
        <div>
          <Label>Type</Label>
          <Select value={type} onChange={(e) => setType(e.target.value as CategoryType)}>
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </Select>
        </div>
        <div>
          <Label>Color</Label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700" />
        </div>
        <Button
          className="mt-2"
          onClick={() => {
            if (!name.trim()) return;
            createCategory.mutate({ name: name.trim(), type, color });
            onClose();
          }}
        >
          Add category
        </Button>
      </div>
    </Modal>
  );
}

function AddRuleModal({ onClose }: { onClose: () => void }) {
  const { data: categories } = useCategories();
  const createRule = useCreateRule();
  const [pattern, setPattern] = useState("");
  const [matchType, setMatchType] = useState<MatchType>("CONTAINS");
  const [amountSign, setAmountSign] = useState<AmountSign>("ANY");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState("0");

  return (
    <Modal title="Add auto-categorization rule" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <Label>Pattern</Label>
          <Input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="e.g. swiggy|zomato" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Match type</Label>
            <Select value={matchType} onChange={(e) => setMatchType(e.target.value as MatchType)}>
              <option value="CONTAINS">Contains</option>
              <option value="STARTS_WITH">Starts with</option>
              <option value="REGEX">Regex</option>
              <option value="EXACT">Exact match</option>
            </Select>
          </div>
          <div>
            <Label>Applies to</Label>
            <Select value={amountSign} onChange={(e) => setAmountSign(e.target.value as AmountSign)}>
              <option value="ANY">Any amount</option>
              <option value="DEBIT">Money out only</option>
              <option value="CREDIT">Money in only</option>
            </Select>
          </div>
        </div>
        <div>
          <Label>Category</Label>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Select category…</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Priority (higher runs first)</Label>
          <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
        </div>
        <Button
          className="mt-2"
          disabled={!pattern.trim() || !categoryId}
          onClick={() => {
            createRule.mutate({ pattern: pattern.trim(), matchType, amountSign, categoryId, priority: Number(priority) || 0 });
            onClose();
          }}
        >
          Add rule
        </Button>
      </div>
    </Modal>
  );
}
