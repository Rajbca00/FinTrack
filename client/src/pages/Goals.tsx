import { useState } from "react";
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal, useAccounts, useAssets } from "../hooks/useApi";
import { Card, Button, Modal, Input, Select, Label, EmptyState, ProgressBar, Loading } from "../components/ui";
import { formatMoney, formatDate, toDateInputValue } from "../lib/format";
import type { Goal } from "../lib/api";

export function Goals() {
  const { data: goals, isLoading } = useGoals();
  const deleteGoal = useDeleteGoal();
  const [showAdd, setShowAdd] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Goals</h1>
          <p className="text-sm text-ink-muted">Track progress towards savings targets like an emergency fund or vacation.</p>
        </div>
        <Button className="self-start sm:self-auto" onClick={() => setShowAdd(true)}>
          + Add goal
        </Button>
      </div>

      {isLoading && <Loading />}
      {!isLoading && (goals?.length ?? 0) === 0 && (
        <EmptyState
          title="Add your first goal"
          message="Set a savings target like an emergency fund, vacation, or home down payment and track progress here."
          action={{ label: "+ Add goal", onClick: () => setShowAdd(true) }}
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {goals?.map((goal) => {
          const pct = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
          const linkedName = goal.linkedAccount?.name ?? goal.linkedAsset?.name;
          return (
            <Card key={goal.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-ink">{goal.name}</p>
                  {goal.targetDate && <p className="text-xs text-ink-muted">Target {formatDate(goal.targetDate)}</p>}
                </div>
                <div className="flex gap-2 text-xs text-ink-muted">
                  <button className="hover:text-brand" onClick={() => setEditingGoal(goal)}>
                    Edit
                  </button>
                  <button
                    className="hover:text-critical"
                    onClick={() => {
                      if (confirm(`Remove ${goal.name}?`)) deleteGoal.mutate(goal.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-baseline justify-between">
                  <p className="text-lg font-semibold text-ink">{formatMoney(goal.currentAmount)}</p>
                  <p className="text-xs text-ink-muted">of {formatMoney(goal.targetAmount)}</p>
                </div>
                <ProgressBar value={pct} color={pct >= 100 ? "var(--color-good)" : undefined} />
              </div>
              {linkedName && <p className="text-xs text-ink-muted">Linked to {linkedName}</p>}
            </Card>
          );
        })}
      </div>

      {showAdd && <GoalModal title="Add goal" onClose={() => setShowAdd(false)} />}
      {editingGoal && <GoalModal title="Edit goal" goal={editingGoal} onClose={() => setEditingGoal(null)} />}
    </div>
  );
}

function GoalModal({ title, goal, onClose }: { title: string; goal?: Goal; onClose: () => void }) {
  const { data: accounts } = useAccounts();
  const { data: assets } = useAssets();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const [name, setName] = useState(goal?.name ?? "");
  const [targetAmount, setTargetAmount] = useState(goal ? String(goal.targetAmount) : "");
  const [currentAmount, setCurrentAmount] = useState(goal ? String(goal.currentAmount) : "0");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ? toDateInputValue(goal.targetDate) : "");
  const [linkType, setLinkType] = useState<"" | "account" | "asset">(
    goal?.linkedAccountId ? "account" : goal?.linkedAssetId ? "asset" : ""
  );
  const [linkedId, setLinkedId] = useState(goal?.linkedAccountId ?? goal?.linkedAssetId ?? "");

  const submit = () => {
    if (!name.trim() || !targetAmount) return;
    const data = {
      name: name.trim(),
      targetAmount: Number(targetAmount),
      currentAmount: Number(currentAmount) || 0,
      targetDate: targetDate || null,
      linkedAccountId: linkType === "account" ? linkedId || null : null,
      linkedAssetId: linkType === "asset" ? linkedId || null : null,
    };
    if (goal) updateGoal.mutate({ id: goal.id, data });
    else createGoal.mutate(data);
    onClose();
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Emergency Fund" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Target amount</Label>
            <Input type="number" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} />
          </div>
          <div>
            <Label>Current amount</Label>
            <Input type="number" value={currentAmount} onChange={(e) => setCurrentAmount(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Target date (optional)</Label>
          <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Link to (optional)</Label>
            <Select
              value={linkType}
              onChange={(e) => {
                setLinkType(e.target.value as typeof linkType);
                setLinkedId("");
              }}
            >
              <option value="">None</option>
              <option value="account">Account</option>
              <option value="asset">Asset</option>
            </Select>
          </div>
          {linkType && (
            <div>
              <Label>{linkType === "account" ? "Account" : "Asset"}</Label>
              <Select value={linkedId} onChange={(e) => setLinkedId(e.target.value)}>
                <option value="">Select…</option>
                {(linkType === "account" ? accounts : assets)?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
        <Button className="mt-2" onClick={submit}>
          {goal ? "Save changes" : "Add goal"}
        </Button>
      </div>
    </Modal>
  );
}
