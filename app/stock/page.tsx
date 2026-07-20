"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { groupProductLines, packageLabel } from "@/lib/calculations";

type Product = {
  id: string;
  name: string;
  variant: string | null;
  packageType: string | null;
  packageSize: string | null;
  unit: string;
};
type StockLevel = {
  id: string;
  name: string;
  variant: string | null;
  packageType: string | null;
  packageSize: number | null;
  unit: string;
  unitsPerBox: number | null;
  baseUnits: number;
  wholePackages: number;
  remainderBaseUnits: number;
};
type InventoryLine = {
  key: string;
  label: string;
  items: StockLevel[];
  totalBaseUnits: number;
};

const emptyTxnForm = {
  lineKey: "", productId: "", txnType: "STOCK_IN",
  entryUnit: "PACKAGE", entryQuantity: "", reference: "", notes: "",
};

const emptyAddForm = {
  mode: "existing" as "existing" | "new",
  existingLineKey: "",
  name: "", variant: "", sku: "",
  packageType: "", packageSize: "", unit: "kg", unitsPerBox: "",
};

const STORAGE_KEY = "cnc-stock-line-order";

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);

  // Log transaction form
  const [showTxnForm, setShowTxnForm] = useState(false);
  const [txnForm, setTxnForm] = useState(emptyTxnForm);
  const [saving, setSaving] = useState(false);

  // Add product form
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [addSaving, setAddSaving] = useState(false);

  // Accordion open state
  const [openLines, setOpenLines] = useState<Set<string>>(new Set());

  // Rename (applies to every SKU sharing the same name+variant, i.e. the whole line)
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameForm, setRenameForm] = useState({ name: "", variant: "" });
  const [renameSaving, setRenameSaving] = useState(false);

  // Delete (per individual SKU/package)
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Drag-to-reorder state (localStorage-persisted)
  const [lineOrder, setLineOrder] = useState<string[]>([]);

  // PointerSensor handles mouse AND touch through one unified code path —
  // this is the fix for drag-to-reorder not working on iOS home-screen
  // installs (native HTML5 drag events never worked via touch on iOS at
  // all, in any context; this replaces that with something that does).
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // small threshold so a tap still opens the accordion instead of starting a drag
    })
  );

  useEffect(() => {
    load();
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setLineOrder(JSON.parse(stored));
    } catch {}
  }, []);

  async function load() {
    const [productsRes, levelsRes] = await Promise.all([
      fetch("/api/products"),
      fetch("/api/stock-levels"),
    ]);
    setProducts(await productsRes.json());
    setStockLevels(await levelsRes.json());
  }

  async function reload() {
    const res = await fetch("/api/stock-levels");
    setStockLevels(await res.json());
  }

  // ── Transaction form ──────────────────────────────────────────────────────
  const lines = groupProductLines(products);
  const selectedTxnLine = lines.find((l) => l.key === txnForm.lineKey);
  const selectedProduct = products.find((p) => p.id === txnForm.productId);

  async function handleTxnSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/stock-transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: txnForm.productId,
        txnType: txnForm.txnType,
        entryUnit: txnForm.entryUnit,
        entryQuantity: parseFloat(txnForm.entryQuantity),
        reference: txnForm.reference || undefined,
        notes: txnForm.notes || undefined,
      }),
    });
    setSaving(false);
    setTxnForm(emptyTxnForm);
    setShowTxnForm(false);
    reload();
  }

  // ── Add product form ──────────────────────────────────────────────────────
  const existingLine = lines.find((l) => l.key === addForm.existingLineKey);
  const existingLineProduct = existingLine?.products[0];

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    setAddSaving(true);
    const body =
      addForm.mode === "existing"
        ? {
            name: existingLineProduct?.name ?? "",
            variant: existingLineProduct?.variant ?? undefined,
            unit: addForm.unit || existingLineProduct?.unit || "kg",
            sku: addForm.sku || undefined,
            packageType: addForm.packageType || undefined,
            packageSize: addForm.packageSize ? parseFloat(addForm.packageSize) : undefined,
            unitsPerBox: addForm.unitsPerBox ? parseInt(addForm.unitsPerBox) : undefined,
          }
        : {
            name: addForm.name,
            variant: addForm.variant || undefined,
            unit: addForm.unit,
            sku: addForm.sku || undefined,
            packageType: addForm.packageType || undefined,
            packageSize: addForm.packageSize ? parseFloat(addForm.packageSize) : undefined,
            unitsPerBox: addForm.unitsPerBox ? parseInt(addForm.unitsPerBox) : undefined,
          };

    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setAddSaving(false);
    setAddForm(emptyAddForm);
    setShowAddProduct(false);
    load();
  }

  // ── Rename (whole product line) ────────────────────────────────────────────
  function startRename(line: InventoryLine) {
    const first = line.items[0];
    setRenameForm({ name: first?.name ?? "", variant: first?.variant ?? "" });
    setRenamingKey(line.key);
  }

  async function submitRename(line: InventoryLine) {
    setRenameSaving(true);
    await Promise.all(
      line.items.map((item) =>
        fetch(`/api/products/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: renameForm.name, variant: renameForm.variant || null }),
        })
      )
    );
    setRenameSaving(false);
    setRenamingKey(null);
    load();
  }

  // ── Delete (single SKU/package) ────────────────────────────────────────────
  async function handleDeleteSku(productId: string, label: string) {
    if (!confirm(`Delete "${label}"? This can't be undone.`)) return;
    setDeletingId(productId);
    const res = await fetch(`/api/products/${productId}`, { method: "DELETE" });
    setDeletingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Couldn't delete this product.");
      return;
    }
    load();
  }

  // ── Inventory accordion data ──────────────────────────────────────────────
  const stockByLine = useMemo(() => {
    const map = new Map<string, StockLevel[]>();
    for (const level of stockLevels) {
      const key = `${level.name}__${level.variant ?? ""}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(level);
    }
    return map;
  }, [stockLevels]);

  const inventoryLines: InventoryLine[] = useMemo(() => {
    return Array.from(stockByLine.entries()).map(([key, items]) => ({
      key,
      label: [items[0].name, items[0].variant].filter(Boolean).join(" "),
      items: [...items].sort((a, b) => (b.packageSize ?? 0) - (a.packageSize ?? 0)),
      totalBaseUnits: items.reduce((s, i) => s + i.baseUnits, 0),
    }));
  }, [stockByLine]);

  const orderedLines: InventoryLine[] = useMemo(() => {
    if (lineOrder.length === 0) return [...inventoryLines].sort((a, b) => a.label.localeCompare(b.label));
    const orderMap = new Map(lineOrder.map((key, i) => [key, i]));
    return [...inventoryLines].sort((a, b) => {
      const ai = orderMap.has(a.key) ? orderMap.get(a.key)! : Infinity;
      const bi = orderMap.has(b.key) ? orderMap.get(b.key)! : Infinity;
      if (ai === Infinity && bi === Infinity) return a.label.localeCompare(b.label);
      return ai - bi;
    });
  }, [inventoryLines, lineOrder]);

  function toggleLine(key: string) {
    setOpenLines((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // ── Drag-to-reorder (dnd-kit, touch + mouse via one PointerSensor) ────────
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedLines.findIndex((l) => l.key === active.id);
    const newIndex = orderedLines.findIndex((l) => l.key === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(orderedLines, oldIndex, newIndex);
    const newOrder = reordered.map((l) => l.key);
    setLineOrder(newOrder);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function quantityLabel(level: StockLevel): string {
    if (!level.packageType || !level.packageSize) return `${level.baseUnits.toFixed(2)} ${level.unit}`;
    const parts: string[] = [];
    if (level.wholePackages > 0) parts.push(`${level.wholePackages} ${level.packageType}${level.wholePackages !== 1 ? "s" : ""}`);
    if (level.remainderBaseUnits > 0.001) parts.push(`${level.remainderBaseUnits.toFixed(2)} ${level.unit}`);
    return parts.length === 0 ? `0 ${level.packageType}s` : parts.join(" + ");
  }
  function stockStatusColor(level: StockLevel): string {
    if (level.baseUnits <= 0) return "text-red-600";
    if (level.wholePackages <= 2) return "text-amber-600";
    return "text-green-700";
  }

  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Stock</h1>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded bg-brand px-4 py-2 text-sm text-brand-navy hover:opacity-90"
          onClick={() => { setShowTxnForm((s) => !s); setShowAddProduct(false); }}
        >
          {showTxnForm ? "Cancel" : "+ Log Transaction"}
        </button>
        <button
          type="button"
          className="rounded border border-brand-navy px-4 py-2 text-sm text-brand-navy hover:bg-brand/20"
          onClick={() => { setShowAddProduct((s) => !s); setShowTxnForm(false); }}
        >
          {showAddProduct ? "Cancel" : "+ Add Product"}
        </button>
      </div>

      {/* Log transaction form */}
      {showTxnForm && (
        <form onSubmit={handleTxnSubmit} className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2">
          <select required className="rounded border px-3 py-2" value={txnForm.lineKey}
            onChange={(e) => setTxnForm({ ...txnForm, lineKey: e.target.value, productId: "" })}>
            <option value="">1. Select product...</option>
            {lines.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
          <select required disabled={!selectedTxnLine} className="rounded border px-3 py-2 disabled:bg-gray-100"
            value={txnForm.productId} onChange={(e) => setTxnForm({ ...txnForm, productId: e.target.value })}>
            <option value="">2. Select package...</option>
            {selectedTxnLine?.products
              .slice()
              .sort((a, b) => (Number(b.packageSize ?? 0) || 0) - (Number(a.packageSize ?? 0) || 0))
              .map((p) => <option key={p.id} value={p.id}>{packageLabel(p)}</option>)}
          </select>
          <select className="rounded border px-3 py-2" value={txnForm.txnType}
            onChange={(e) => setTxnForm({ ...txnForm, txnType: e.target.value })}>
            <option value="STOCK_IN">Stock In (received)</option>
            <option value="STOCK_OUT">Stock Out</option>
            <option value="ADJUSTMENT">Adjustment</option>
          </select>
          <select className="rounded border px-3 py-2" value={txnForm.entryUnit}
            onChange={(e) => setTxnForm({ ...txnForm, entryUnit: e.target.value })}>
            <option value="PACKAGE">By the {selectedProduct?.packageType?.toLowerCase() ?? "package"}</option>
            <option value="BASE_UNIT">By the {selectedProduct?.unit ?? "unit"} (partial)</option>
          </select>
          <input required type="number" step="0.001"
            placeholder={txnForm.entryUnit === "PACKAGE"
              ? `How many ${selectedProduct?.packageType?.toLowerCase() ?? "packages"}?`
              : `How many ${selectedProduct?.unit ?? "units"}?`}
            className="rounded border px-3 py-2 sm:col-span-2"
            value={txnForm.entryQuantity} onChange={(e) => setTxnForm({ ...txnForm, entryQuantity: e.target.value })} />
          <input placeholder="Reference (optional)" className="rounded border px-3 py-2"
            value={txnForm.reference} onChange={(e) => setTxnForm({ ...txnForm, reference: e.target.value })} />
          <input placeholder="Notes (optional)" className="rounded border px-3 py-2"
            value={txnForm.notes} onChange={(e) => setTxnForm({ ...txnForm, notes: e.target.value })} />
          <button disabled={saving}
            className="w-full rounded bg-brand px-3 py-2 text-sm text-brand-navy hover:opacity-90 disabled:opacity-50 sm:col-span-2">
            {saving ? "Saving..." : "Log transaction"}
          </button>
        </form>
      )}

      {/* Add product form */}
      {showAddProduct && (
        <form onSubmit={handleAddProduct} className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2">
          <div className="flex gap-2 sm:col-span-2">
            {(["existing", "new"] as const).map((m) => (
              <button key={m} type="button"
                className={`rounded px-3 py-1.5 text-sm ${addForm.mode === m ? "bg-brand text-brand-navy font-medium" : "border text-gray-600 hover:bg-gray-50"}`}
                onClick={() => setAddForm({ ...emptyAddForm, mode: m })}>
                {m === "existing" ? "New packaging for existing product" : "Brand-new product"}
              </button>
            ))}
          </div>

          {addForm.mode === "existing" ? (
            <>
              <select required className="rounded border px-3 py-2 sm:col-span-2"
                value={addForm.existingLineKey}
                onChange={(e) => setAddForm({ ...addForm, existingLineKey: e.target.value })}>
                <option value="">Select existing product...</option>
                {lines.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
              </select>
              {existingLineProduct && (
                <p className="text-xs text-gray-500 sm:col-span-2">
                  Unit inherited: <strong>{existingLineProduct.unit}</strong>
                </p>
              )}
            </>
          ) : (
            <>
              <input required placeholder="Product name (e.g. Hector Grease)" className="rounded border px-3 py-2"
                value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
              <input placeholder="Variant (e.g. 4, 75W90) — optional" className="rounded border px-3 py-2"
                value={addForm.variant} onChange={(e) => setAddForm({ ...addForm, variant: e.target.value })} />
            </>
          )}

          <input placeholder="Package type (e.g. Drum, Keg, Pail)" className="rounded border px-3 py-2"
            value={addForm.packageType} onChange={(e) => setAddForm({ ...addForm, packageType: e.target.value })} />
          <input type="number" step="0.001" placeholder="Package size (e.g. 181.4)" className="rounded border px-3 py-2"
            value={addForm.packageSize} onChange={(e) => setAddForm({ ...addForm, packageSize: e.target.value })} />

          {addForm.mode === "new" && (
            <input required={addForm.mode === "new"} placeholder="Unit (e.g. kg, L)" className="rounded border px-3 py-2"
              value={addForm.unit} onChange={(e) => setAddForm({ ...addForm, unit: e.target.value })} />
          )}

          <input placeholder="SKU (optional)" className="rounded border px-3 py-2"
            value={addForm.sku} onChange={(e) => setAddForm({ ...addForm, sku: e.target.value })} />
          <input type="number" placeholder="Units per box (optional)" className="rounded border px-3 py-2"
            value={addForm.unitsPerBox} onChange={(e) => setAddForm({ ...addForm, unitsPerBox: e.target.value })} />

          <button disabled={addSaving}
            className="w-full rounded bg-brand px-3 py-2 text-sm text-brand-navy hover:opacity-90 disabled:opacity-50 sm:col-span-2">
            {addSaving ? "Saving..." : "Save product"}
          </button>
        </form>
      )}

      {/* Inventory accordion */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium">Current Inventory</h2>
          <span className="text-xs text-gray-400">Drag ⠿ to reorder</span>
        </div>
        <div className="overflow-hidden rounded-lg border bg-white">
          {orderedLines.length === 0 && (
            <div className="p-4 text-sm text-gray-400">No stock data yet.</div>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedLines.map((l) => l.key)} strategy={verticalListSortingStrategy}>
              {orderedLines.map((line, idx) => (
                <InventoryLineRow
                  key={line.key}
                  line={line}
                  isFirst={idx === 0}
                  isOpen={openLines.has(line.key)}
                  toggleLine={toggleLine}
                  isRenaming={renamingKey === line.key}
                  renameForm={renameForm}
                  setRenameForm={setRenameForm}
                  renameSaving={renameSaving}
                  startRename={startRename}
                  submitRename={submitRename}
                  cancelRename={() => setRenamingKey(null)}
                  deletingId={deletingId}
                  handleDeleteSku={handleDeleteSku}
                  quantityLabel={quantityLabel}
                  stockStatusColor={stockStatusColor}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </section>
    </main>
  );
}

// Extracted so useSortable (a hook) can be called once per row, not inside
// a .map() callback in the parent.
function InventoryLineRow({
  line, isFirst, isOpen, toggleLine,
  isRenaming, renameForm, setRenameForm, renameSaving, startRename, submitRename, cancelRename,
  deletingId, handleDeleteSku, quantityLabel, stockStatusColor,
}: {
  line: InventoryLine;
  isFirst: boolean;
  isOpen: boolean;
  toggleLine: (key: string) => void;
  isRenaming: boolean;
  renameForm: { name: string; variant: string };
  setRenameForm: (f: { name: string; variant: string }) => void;
  renameSaving: boolean;
  startRename: (line: InventoryLine) => void;
  submitRename: (line: InventoryLine) => void;
  cancelRename: () => void;
  deletingId: string | null;
  handleDeleteSku: (id: string, label: string) => void;
  quantityLabel: (level: StockLevel) => string;
  stockStatusColor: (level: StockLevel) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: line.key });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${!isFirst ? "border-t" : ""} bg-white ${isDragging ? "relative z-10 shadow-md" : ""}`}
    >
      <div className="flex w-full items-center">
        {/* Drag handle — touch-none is required so iOS hands the gesture to
            JS instead of trying to scroll the page with it */}
        <span
          {...attributes}
          {...listeners}
          className="touch-none cursor-grab px-3 py-3 text-gray-300 select-none active:cursor-grabbing"
          title="Drag to reorder"
        >
          ⠿
        </span>
        <button
          type="button"
          className="flex flex-1 items-center justify-between py-3 pr-2 text-left hover:bg-gray-50"
          onClick={() => toggleLine(line.key)}
        >
          <span className="font-medium">{line.label}</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {line.items.length} SKU{line.items.length !== 1 ? "s" : ""}
            </span>
            <span className="text-lg text-gray-400">{isOpen ? "▲" : "▼"}</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => (isRenaming ? cancelRename() : startRename(line))}
          className="whitespace-nowrap px-3 py-3 text-xs text-brand-navy underline"
          title="Rename this product"
        >
          {isRenaming ? "Cancel" : "Rename"}
        </button>
      </div>

      {isRenaming && (
        <div className="flex flex-wrap items-center gap-2 border-t bg-brand/10 px-4 py-3">
          <input
            className="rounded border px-2 py-1.5 text-sm"
            placeholder="Product name"
            value={renameForm.name}
            onChange={(e) => setRenameForm({ ...renameForm, name: e.target.value })}
          />
          <input
            className="rounded border px-2 py-1.5 text-sm"
            placeholder="Variant (optional)"
            value={renameForm.variant}
            onChange={(e) => setRenameForm({ ...renameForm, variant: e.target.value })}
          />
          <button
            type="button"
            disabled={renameSaving || !renameForm.name}
            onClick={() => submitRename(line)}
            className="rounded bg-brand px-3 py-1.5 text-xs text-brand-navy hover:opacity-90 disabled:opacity-50"
          >
            {renameSaving ? "Saving..." : "Save name"}
          </button>
          <span className="text-xs text-gray-500">
            Updates all {line.items.length} package{line.items.length !== 1 ? "s" : ""} of this product.
          </span>
        </div>
      )}

      {isOpen && (
        <div className="border-t bg-gray-50">
          {line.items.map((level) => {
            const label = packageLabel({ packageType: level.packageType, packageSize: level.packageSize, unit: level.unit });
            return (
              <div key={level.id} className="flex items-center justify-between border-t px-6 py-2.5 text-sm first:border-t-0">
                <span className="text-gray-600">{label}</span>
                <div className="flex items-center gap-3">
                  <span className={`font-semibold ${stockStatusColor(level)}`}>{quantityLabel(level)}</span>
                  <button
                    type="button"
                    disabled={deletingId === level.id}
                    onClick={() => handleDeleteSku(level.id, `${line.label} — ${label}`)}
                    className="text-xs text-red-600 underline disabled:opacity-50"
                    title="Delete this product (only allowed if it has no stock/invoice history)"
                  >
                    {deletingId === level.id ? "..." : "Delete"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
