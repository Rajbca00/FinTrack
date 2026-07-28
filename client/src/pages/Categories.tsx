import { useState } from "react";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useRules,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useApplyRules,
} from "../hooks/useApi";
import { Card, Button, Modal, Input, Select, Label, Badge, EmptyState } from "../components/ui";
import { assignableCategories } from "../lib/api";
import type { AmountSign, Category, CategoryRule, CategoryType, MatchType } from "../lib/api";

export function Categories() {
  const { data: categories } = useCategories();
  const { data: rules } = useRules();
  const deleteCategory = useDeleteCategory();
  const deleteRule = useDeleteRule();
  const updateRule = useUpdateRule();
  const applyRules = useApplyRules();
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingRule, setEditingRule] = useState<CategoryRule | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-ink">Categories</h1>
            <p className="text-sm text-ink-muted">Custom categories used to classify income and expenses.</p>
          </div>
          <Button className="self-start sm:self-auto" onClick={() => setShowAddCategory(true)}>
            + Add category
          </Button>
        </div>
        <Card>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {categories?.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-hairline">
                <Badge color={c.color}>{c.name}</Badge>
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <span>{c.type.toLowerCase()}</span>
                  <button className="hover:text-brand" onClick={() => setEditingCategory(c)}>
                    Edit
                  </button>
                  {!c.isSystem && (c._count?.transactions ?? 0) === 0 && (
                    <button className="hover:text-critical" onClick={() => deleteCategory.mutate(c.id)}>
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
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-ink">Auto-categorization rules</h1>
            <p className="text-sm text-ink-muted">
              Rules run in priority order (highest first) whenever a transaction is imported or manually added.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => applyRules.mutate({ overwrite: false })} disabled={applyRules.isPending}>
              Apply to uncategorized
            </Button>
            <Button onClick={() => setShowAddRule(true)}>+ Add rule</Button>
          </div>
        </div>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-ink-muted dark:bg-white/5 dark:text-ink-muted">
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
            <tbody className="divide-y divide-slate-100 dark:divide-hairline">
              {rules?.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-mono text-xs">{r.pattern}</td>
                  <td className="px-4 py-2 text-xs text-ink-muted">{r.matchType}</td>
                  <td className="px-4 py-2 text-xs text-ink-muted">{r.amountSign}</td>
                  <td className="px-4 py-2">
                    <Badge color={r.category?.color}>{r.category?.name}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-ink-muted">{r.priority}</td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={r.isActive}
                      onChange={(e) => updateRule.mutate({ id: r.id, data: { isActive: e.target.checked } })}
                      className="h-4 w-4 accent-brand"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button className="mr-3 text-xs text-ink-muted hover:text-brand" onClick={() => setEditingRule(r)}>
                      Edit
                    </button>
                    <button className="text-xs text-ink-muted hover:text-critical" onClick={() => deleteRule.mutate(r.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(rules?.length ?? 0) === 0 && (
            <EmptyState
              title="Add your first rule"
              message="Auto-categorization rules run whenever a transaction is imported or added, so future statements need less manual cleanup."
              action={{ label: "+ Add rule", onClick: () => setShowAddRule(true) }}
            />
          )}
        </Card>
      </div>

      {showAddCategory && <AddCategoryModal onClose={() => setShowAddCategory(false)} />}
      {showAddRule && <AddRuleModal onClose={() => setShowAddRule(false)} />}
      {editingCategory && <EditCategoryModal category={editingCategory} onClose={() => setEditingCategory(null)} />}
      {editingRule && <EditRuleModal rule={editingRule} onClose={() => setEditingRule(null)} />}
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
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-full rounded-lg border border-slate-300 dark:border-hairline-strong" />
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
  const [notes, setNotes] = useState("");

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
            {assignableCategories(categories).map((c) => (
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
        <div>
          <Label>Notes (optional)</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Auto-filled onto matching transactions when left blank"
          />
        </div>
        <Button
          className="mt-2"
          disabled={!pattern.trim() || !categoryId}
          onClick={() => {
            createRule.mutate({
              pattern: pattern.trim(),
              matchType,
              amountSign,
              categoryId,
              priority: Number(priority) || 0,
              notes: notes.trim() || null,
            });
            onClose();
          }}
        >
          Add rule
        </Button>
      </div>
    </Modal>
  );
}

function EditCategoryModal({ category, onClose }: { category: Category; onClose: () => void }) {
  const updateCategory = useUpdateCategory();
  const [name, setName] = useState(category.name);
  const [type, setType] = useState<CategoryType>(category.type === "TRANSFER" ? "EXPENSE" : category.type);
  const [color, setColor] = useState(category.color ?? "#2a78d6");

  return (
    <Modal title="Edit category" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <Label>Type</Label>
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as CategoryType)}
            disabled={category.isSystem}
          >
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
            {category.type === "TRANSFER" && <option value="TRANSFER">Transfer</option>}
          </Select>
          {category.isSystem && (
            <p className="mt-1 text-xs text-ink-muted">System category type can't be changed.</p>
          )}
        </div>
        <div>
          <Label>Color</Label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-300 dark:border-hairline-strong"
          />
        </div>
        <Button
          className="mt-2"
          onClick={() => {
            if (!name.trim()) return;
            updateCategory.mutate({ id: category.id, data: { name: name.trim(), type, color } });
            onClose();
          }}
        >
          Save changes
        </Button>
      </div>
    </Modal>
  );
}

function EditRuleModal({ rule, onClose }: { rule: CategoryRule; onClose: () => void }) {
  const { data: categories } = useCategories();
  const updateRule = useUpdateRule();
  const [pattern, setPattern] = useState(rule.pattern);
  const [matchType, setMatchType] = useState<MatchType>(rule.matchType);
  const [amountSign, setAmountSign] = useState<AmountSign>(rule.amountSign);
  const [categoryId, setCategoryId] = useState(rule.categoryId);
  const [priority, setPriority] = useState(String(rule.priority));
  const [notes, setNotes] = useState(rule.notes ?? "");

  return (
    <Modal title="Edit auto-categorization rule" onClose={onClose}>
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
            {assignableCategories(categories).map((c) => (
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
        <div>
          <Label>Notes (optional)</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Auto-filled onto matching transactions when left blank"
          />
        </div>
        <Button
          className="mt-2"
          disabled={!pattern.trim() || !categoryId}
          onClick={() => {
            updateRule.mutate({
              id: rule.id,
              data: {
                pattern: pattern.trim(),
                matchType,
                amountSign,
                categoryId,
                priority: Number(priority) || 0,
                notes: notes.trim() || null,
              },
            });
            onClose();
          }}
        >
          Save changes
        </Button>
      </div>
    </Modal>
  );
}
