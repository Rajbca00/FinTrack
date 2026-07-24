import { useState } from "react";
import {
  useAssets,
  useCreateAsset,
  useUpdateAsset,
  useDeleteAsset,
  useLiabilities,
  useCreateLiability,
  useUpdateLiability,
  useDeleteLiability,
  useNetWorth,
} from "../hooks/useApi";
import { Card, Button, Modal, Input, Select, Label, EmptyState, Loading } from "../components/ui";
import { formatMoney, formatDate, toDateInputValue, ASSET_TYPE_LABELS, LIABILITY_TYPE_LABELS } from "../lib/format";
import type { Asset, AssetType, Liability, LiabilityType } from "../lib/api";

export function NetWorth() {
  const { data: netWorth } = useNetWorth();
  const { data: assets, isLoading: assetsLoading } = useAssets();
  const { data: liabilities, isLoading: liabilitiesLoading } = useLiabilities();
  const deleteAsset = useDeleteAsset();
  const deleteLiability = useDeleteLiability();
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showAddLiability, setShowAddLiability] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editingLiability, setEditingLiability] = useState<Liability | null>(null);

  const stats = [
    { label: "Cash & Bank", value: netWorth?.cashAndBank },
    { label: "Investments", value: netWorth?.investments },
    { label: "Retirement", value: netWorth?.retirement },
    { label: "Other Assets", value: netWorth?.otherAssets },
    { label: "Liabilities", value: netWorth?.liabilities, negative: true },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-ink">Net Worth</h1>
        <p className="text-sm text-ink-muted">Everything you own and owe outside of day-to-day transactions.</p>
      </div>

      <Card className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-medium text-ink-muted">Net Worth</p>
          <p className={`text-3xl font-semibold ${(netWorth?.netWorth ?? 0) < 0 ? "text-critical" : "text-ink"}`}>
            {formatMoney(netWorth?.netWorth ?? 0)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-hairline pt-4 sm:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-xs text-ink-muted">{s.label}</p>
              <p className={`text-sm font-semibold ${s.negative && (s.value ?? 0) > 0 ? "text-critical" : "text-ink"}`}>
                {formatMoney(s.value ?? 0)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Assets</h2>
            <p className="text-sm text-ink-muted">Fixed deposits, mutual funds, retirement, gold, property, and more.</p>
          </div>
          <Button className="self-start sm:self-auto" onClick={() => setShowAddAsset(true)}>
            + Add asset
          </Button>
        </div>
        {assetsLoading && <Loading />}
        {!assetsLoading && (assets?.length ?? 0) === 0 && (
          <EmptyState
            title="Add your first asset"
            message="Fixed deposits, mutual funds, EPF/PPF, gold, and property all contribute to your net worth here."
            action={{ label: "+ Add asset", onClick: () => setShowAddAsset(true) }}
          />
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assets?.map((asset) => (
            <Card key={asset.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-ink">{asset.name}</p>
                  <p className="text-xs text-ink-muted">{ASSET_TYPE_LABELS[asset.type] ?? asset.type}</p>
                </div>
                <div className="flex gap-2 text-xs text-ink-muted">
                  <button className="hover:text-brand" onClick={() => setEditingAsset(asset)}>
                    Edit
                  </button>
                  <button
                    className="hover:text-critical"
                    onClick={() => {
                      if (confirm(`Remove ${asset.name}?`)) deleteAsset.mutate(asset.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="text-xl font-semibold text-ink">{formatMoney(asset.currentValue)}</p>
              {asset.purchaseValue != null && (
                <p className="text-xs text-ink-muted">Purchased at {formatMoney(asset.purchaseValue)}</p>
              )}
              <p className="text-xs text-ink-muted">Updated {formatDate(asset.updatedAt)}</p>
              {asset.notes && <p className="text-xs text-ink-secondary">{asset.notes}</p>}
            </Card>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Liabilities</h2>
            <p className="text-sm text-ink-muted">Loans and debts tracked outside your accounts.</p>
          </div>
          <Button className="self-start sm:self-auto" onClick={() => setShowAddLiability(true)}>
            + Add liability
          </Button>
        </div>
        {liabilitiesLoading && <Loading />}
        {!liabilitiesLoading && (liabilities?.length ?? 0) === 0 && (
          <EmptyState
            title="Add your first liability"
            message="Track a home loan, personal loan, or other debt to see it reflected in your net worth."
            action={{ label: "+ Add liability", onClick: () => setShowAddLiability(true) }}
          />
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {liabilities?.map((liability) => (
            <Card key={liability.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-ink">{liability.name}</p>
                  <p className="text-xs text-ink-muted">
                    {LIABILITY_TYPE_LABELS[liability.type] ?? liability.type}
                    {liability.lender ? ` · ${liability.lender}` : ""}
                  </p>
                </div>
                <div className="flex gap-2 text-xs text-ink-muted">
                  <button className="hover:text-brand" onClick={() => setEditingLiability(liability)}>
                    Edit
                  </button>
                  <button
                    className="hover:text-critical"
                    onClick={() => {
                      if (confirm(`Remove ${liability.name}?`)) deleteLiability.mutate(liability.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="text-xl font-semibold text-critical">{formatMoney(liability.outstandingBalance)}</p>
              <div className="flex flex-wrap gap-x-3 text-xs text-ink-muted">
                {liability.interestRate != null && <span>{liability.interestRate}% interest</span>}
                {liability.emiAmount != null && <span>EMI {formatMoney(liability.emiAmount)}</span>}
                {liability.nextDueDate && <span>Next due {formatDate(liability.nextDueDate)}</span>}
              </div>
              {liability.notes && <p className="text-xs text-ink-secondary">{liability.notes}</p>}
            </Card>
          ))}
        </div>
      </div>

      {showAddAsset && <AssetModal title="Add asset" onClose={() => setShowAddAsset(false)} />}
      {editingAsset && <AssetModal title="Edit asset" asset={editingAsset} onClose={() => setEditingAsset(null)} />}
      {showAddLiability && <LiabilityModal title="Add liability" onClose={() => setShowAddLiability(false)} />}
      {editingLiability && (
        <LiabilityModal title="Edit liability" liability={editingLiability} onClose={() => setEditingLiability(null)} />
      )}
    </div>
  );
}

const ASSET_TYPE_OPTIONS = Object.keys(ASSET_TYPE_LABELS) as AssetType[];
const LIABILITY_TYPE_OPTIONS = Object.keys(LIABILITY_TYPE_LABELS) as LiabilityType[];

function AssetModal({ title, asset, onClose }: { title: string; asset?: Asset; onClose: () => void }) {
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const [name, setName] = useState(asset?.name ?? "");
  const [type, setType] = useState<AssetType>(asset?.type ?? "FIXED_DEPOSIT");
  const [currentValue, setCurrentValue] = useState(asset ? String(asset.currentValue) : "");
  const [purchaseValue, setPurchaseValue] = useState(asset?.purchaseValue != null ? String(asset.purchaseValue) : "");
  const [notes, setNotes] = useState(asset?.notes ?? "");

  const submit = () => {
    if (!name.trim() || !currentValue) return;
    const data = {
      name: name.trim(),
      type,
      currentValue: Number(currentValue),
      purchaseValue: purchaseValue ? Number(purchaseValue) : null,
      notes: notes.trim() || null,
    };
    if (asset) updateAsset.mutate({ id: asset.id, data });
    else createAsset.mutate(data);
    onClose();
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HDFC Fixed Deposit" autoFocus />
        </div>
        <div>
          <Label>Type</Label>
          <Select value={type} onChange={(e) => setType(e.target.value as AssetType)}>
            {ASSET_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {ASSET_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Current value</Label>
            <Input type="number" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
          </div>
          <div>
            <Label>Purchase value (optional)</Label>
            <Input type="number" value={purchaseValue} onChange={(e) => setPurchaseValue(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </div>
        <Button className="mt-2" onClick={submit}>
          {asset ? "Save changes" : "Add asset"}
        </Button>
      </div>
    </Modal>
  );
}

function LiabilityModal({ title, liability, onClose }: { title: string; liability?: Liability; onClose: () => void }) {
  const createLiability = useCreateLiability();
  const updateLiability = useUpdateLiability();
  const [name, setName] = useState(liability?.name ?? "");
  const [type, setType] = useState<LiabilityType>(liability?.type ?? "HOME_LOAN");
  const [outstandingBalance, setOutstandingBalance] = useState(liability ? String(liability.outstandingBalance) : "");
  const [interestRate, setInterestRate] = useState(liability?.interestRate != null ? String(liability.interestRate) : "");
  const [emiAmount, setEmiAmount] = useState(liability?.emiAmount != null ? String(liability.emiAmount) : "");
  const [nextDueDate, setNextDueDate] = useState(liability?.nextDueDate ? toDateInputValue(liability.nextDueDate) : "");
  const [lender, setLender] = useState(liability?.lender ?? "");
  const [notes, setNotes] = useState(liability?.notes ?? "");

  const submit = () => {
    if (!name.trim() || !outstandingBalance) return;
    const data = {
      name: name.trim(),
      type,
      outstandingBalance: Number(outstandingBalance),
      interestRate: interestRate ? Number(interestRate) : null,
      emiAmount: emiAmount ? Number(emiAmount) : null,
      nextDueDate: nextDueDate || null,
      lender: lender.trim() || null,
      notes: notes.trim() || null,
    };
    if (liability) updateLiability.mutate({ id: liability.id, data });
    else createLiability.mutate(data);
    onClose();
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Home Loan - SBI" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={type} onChange={(e) => setType(e.target.value as LiabilityType)}>
              {LIABILITY_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {LIABILITY_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Lender (optional)</Label>
            <Input value={lender} onChange={(e) => setLender(e.target.value)} placeholder="e.g. SBI" />
          </div>
        </div>
        <div>
          <Label>Outstanding balance</Label>
          <Input type="number" value={outstandingBalance} onChange={(e) => setOutstandingBalance(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Interest rate % (optional)</Label>
            <Input type="number" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
          </div>
          <div>
            <Label>Monthly EMI (optional)</Label>
            <Input type="number" value={emiAmount} onChange={(e) => setEmiAmount(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Next due date (optional)</Label>
          <Input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
        </div>
        <div>
          <Label>Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </div>
        <Button className="mt-2" onClick={submit}>
          {liability ? "Save changes" : "Add liability"}
        </Button>
      </div>
    </Modal>
  );
}
