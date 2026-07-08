import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Product, ProductUnit } from '../lib/types'
import { useStore } from '../store/useStore'
import { fmtMoney } from '../lib/format'
import { Modal } from '../components/ui/Modal'

export function MenuPage() {
  const {
    categories,
    products,
    settings,
    addCategory,
    renameCategory,
    deleteCategory,
    addProduct,
    updateProduct,
    deleteProduct,
  } = useStore()
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [editing, setEditing] = useState<Product | 'new' | null>(null)

  const visible = products.filter((p) => selectedCat === null || p.categoryId === selectedCat)

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-stone-900">Menu</h1>
          <p className="text-sm text-stone-500">What you sell — categories, products and prices</p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
        >
          <Plus size={16} /> New product
        </button>
      </header>

      {/* Category chips */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setSelectedCat(null)}
          className={`rounded-xl px-3 py-1.5 text-sm font-medium ${
            selectedCat === null ? 'bg-stone-900 text-white' : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-100'
          }`}
        >
          All ({products.length})
        </button>
        {categories.map((c) => (
          <div key={c.id} className="group relative">
            <button
              onClick={() => setSelectedCat(c.id)}
              onDoubleClick={() => {
                const name = window.prompt('Rename category', c.name)
                if (name?.trim()) renameCategory(c.id, name.trim())
              }}
              title="Double-click to rename"
              className={`rounded-xl px-3 py-1.5 text-sm font-medium ${
                selectedCat === c.id ? 'bg-stone-900 text-white' : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-100'
              }`}
            >
              {c.name} ({products.filter((p) => p.categoryId === c.id).length})
            </button>
          </div>
        ))}
        <button
          onClick={() => {
            const name = window.prompt('Category name (e.g. Desserts)')
            if (name?.trim()) addCategory(name.trim())
          }}
          className="flex items-center gap-1 rounded-xl border border-dashed border-stone-300 px-3 py-1.5 text-sm text-stone-500 hover:border-stone-400 hover:text-stone-700"
        >
          <Plus size={14} /> Category
        </button>
        {selectedCat !== null && (
          <button
            onClick={() => {
              const cat = categories.find((c) => c.id === selectedCat)
              if (
                cat &&
                window.confirm(`Delete "${cat.name}" and its ${products.filter((p) => p.categoryId === cat.id).length} products?`)
              ) {
                deleteCategory(cat.id)
                setSelectedCat(null)
              }
            }}
            className="ml-auto flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm text-red-500 hover:bg-red-50"
          >
            <Trash2 size={14} /> Delete category
          </button>
        )}
      </div>

      {/* Product table */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-14 text-center text-sm text-stone-500">
          No products yet — add your first one with “New product”.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs uppercase tracking-wide text-stone-400">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 text-center font-medium">On sale</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {visible.map((p) => (
                <tr key={p.id} className={p.active ? '' : 'opacity-50'}>
                  <td className="px-4 py-2.5 font-medium text-stone-900">
                    {p.name}
                    {p.barcode && (
                      <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-normal text-stone-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        ⌷ {p.barcode}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-stone-500">
                    {categories.find((c) => c.id === p.categoryId)?.name ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-stone-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {fmtMoney(p.price, settings.currency)}
                    {p.unit === 'kg' && <span className="text-xs text-stone-400"> /kg</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      role="switch"
                      aria-checked={p.active}
                      aria-label={`${p.name} on sale`}
                      onClick={() => updateProduct(p.id, { active: !p.active })}
                      className={`relative h-5 w-9 rounded-full transition-colors ${p.active ? 'bg-green-500' : 'bg-stone-300'}`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${p.active ? 'left-[18px]' : 'left-0.5'}`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditing(p)}
                        className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                        aria-label={`Edit ${p.name}`}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete "${p.name}"?`)) deleteProduct(p.id)
                        }}
                        className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Delete ${p.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ProductModal
          product={editing === 'new' ? null : editing}
          defaultCategoryId={selectedCat ?? categories[0]?.id ?? ''}
          onClose={() => setEditing(null)}
          onSave={(data) => {
            if (editing === 'new') addProduct({ ...data, active: true })
            else updateProduct(editing.id, data)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function ProductModal({
  product,
  defaultCategoryId,
  onClose,
  onSave,
}: {
  product: Product | null
  defaultCategoryId: string
  onClose: () => void
  onSave: (data: { name: string; price: number; categoryId: string; unit: ProductUnit; barcode?: string }) => void
}) {
  const { categories, addCategory } = useStore()
  const [name, setName] = useState(product?.name ?? '')
  const [price, setPrice] = useState(product ? String(product.price) : '')
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? defaultCategoryId)
  const [unit, setUnit] = useState<ProductUnit>(product?.unit ?? 'each')
  const [barcode, setBarcode] = useState(product?.barcode ?? '')
  const [error, setError] = useState<string | null>(null)

  return (
    <Modal title={product ? `Edit ${product.name}` : 'New product'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const parsed = Number(price.replace(',', '.'))
          const code = barcode.trim()
          if (!name.trim()) return setError('Give the product a name.')
          if (!Number.isFinite(parsed) || parsed < 0) return setError('Enter a valid price, e.g. 2.50.')
          if (!categoryId) return setError('Pick a category — or create one first on the Menu page.')
          if (code && !/^[0-9A-Za-z\-_.]{4,20}$/.test(code))
            return setError('Barcodes are 4–20 characters (digits and letters).')
          onSave({
            name: name.trim(),
            price: Math.round(parsed * 100) / 100,
            categoryId,
            unit,
            barcode: code || undefined,
          })
        }}
        className="space-y-3"
      >
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="e.g. Cappuccino"
            autoFocus
          />
        </label>
        <div className="flex gap-3">
          <label className="block flex-1">
            <span className="mb-1 block text-sm font-medium text-stone-700">Price</span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              placeholder="2.50"
            />
          </label>
          <label className="block w-40">
            <span className="mb-1 block text-sm font-medium text-stone-700">Sold</span>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as ProductUnit)}
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="each">Per item</option>
              <option value="kg">By weight (€/kg)</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">
            Barcode <span className="font-normal text-stone-400">(optional — scanner or in-store “2…” prefix)</span>
          </span>
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            inputMode="numeric"
            className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="e.g. 5601312111111 or 2000001"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">Category</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            {categories.length === 0 && <option value="">No categories yet</option>}
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {categories.length === 0 && (
          <button
            type="button"
            onClick={() => {
              const n = window.prompt('Category name (e.g. Coffee)')
              if (n?.trim()) addCategory(n.trim())
            }}
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            + Create a category
          </button>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">
            Cancel
          </button>
          <button type="submit" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
