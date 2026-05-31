window.ProductModal = ({
  productModalOpen,
  setProductModalOpen,
  editingProduct,
  setEditingProduct,
  productForm,
  setProductForm,
  uploadingImage,
  imgInputRef,
  handleProductImageUpload,
  handleProductFormSubmit,
  showToast
}) => {
  if (!productModalOpen) return null;

  // Set reactive subcategories
  const subCategoryOptions = (() => {
    if (productForm.category === 'Mukena') {
      return ['Rayon Premium', 'Silk Silk', 'Katun Adem', 'Premium Renda', 'Lainnya'];
    } else if (productForm.category === 'Hijab') {
      return ['Segiempat', 'Pashmina', 'Instant', 'Khimar', 'Lainnya'];
    } else if (productForm.category === 'Label') {
      return ['Label Woven', 'Label Satin', 'Label Akrilik', 'Label Kulit', 'Lainnya'];
    }
    return ['Lainnya'];
  })();

  // Initialize variants and wholesale_tiers arrays if undefined
  const variants = productForm.variants || [];
  const wholesale_tiers = productForm.wholesale_tiers || [];

  // Helper functions for Variants
  const handleAddVariant = () => {
    const newVariant = {
      id: 'var-' + Date.now() + '-' + Math.round(Math.random() * 1000),
      name: '',
      price_retail: parseFloat(productForm.price_retail) || 0,
      price_reseller: parseFloat(productForm.price_reseller) || 0,
      stock: parseInt(productForm.stock) || 0,
      weight: parseInt(productForm.weight) || 0,
      sizes: []
    };
    setProductForm({ ...productForm, variants: [...variants, newVariant] });
  };

  const handleUpdateVariant = (index, field, value) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    setProductForm({ ...productForm, variants: updated });
  };

  const handleRemoveVariant = (index) => {
    const updated = [...variants];
    updated.splice(index, 1);
    setProductForm({ ...productForm, variants: updated });
  };

  // Helper functions for sizes under a specific variant
  const handleAddSizeToVariant = (varIndex) => {
    const updated = [...variants];
    const newSize = {
      id: 'sz-' + Date.now() + '-' + Math.round(Math.random() * 1000),
      size: '',
      price_retail: parseFloat(updated[varIndex].price_retail) || 0,
      price_reseller: parseFloat(updated[varIndex].price_reseller) || 0,
      stock: parseInt(updated[varIndex].stock) || 0,
      weight: parseInt(updated[varIndex].weight) || 0
    };
    updated[varIndex] = {
      ...updated[varIndex],
      sizes: [...(updated[varIndex].sizes || []), newSize]
    };
    setProductForm({ ...productForm, variants: updated });
  };

  const handleUpdateVariantSize = (varIndex, sizeIndex, field, value) => {
    const updated = [...variants];
    const updatedSizes = [...(updated[varIndex].sizes || [])];
    updatedSizes[sizeIndex] = { ...updatedSizes[sizeIndex], [field]: value };
    updated[varIndex] = { ...updated[varIndex], sizes: updatedSizes };
    setProductForm({ ...productForm, variants: updated });
  };

  const handleRemoveVariantSize = (varIndex, sizeIndex) => {
    const updated = [...variants];
    const updatedSizes = [...(updated[varIndex].sizes || [])];
    updatedSizes.splice(sizeIndex, 1);
    updated[varIndex] = { ...updated[varIndex], sizes: updatedSizes };
    setProductForm({ ...productForm, variants: updated });
  };

  // Helper functions for Wholesale Tiers
  const handleAddWholesaleTier = () => {
    const newTier = {
      id: 'tier-' + Date.now() + '-' + Math.round(Math.random() * 1000),
      min_qty: 6,
      max_qty: '',
      price_retail: parseFloat(productForm.price_retail) || 0,
      price_reseller: parseFloat(productForm.price_reseller) || 0
    };
    setProductForm({ ...productForm, wholesale_tiers: [...wholesale_tiers, newTier] });
  };

  const handleUpdateWholesaleTier = (index, field, value) => {
    const updated = [...wholesale_tiers];
    updated[index] = { ...updated[index], [field]: value };
    setProductForm({ ...productForm, wholesale_tiers: updated });
  };

  const handleRemoveWholesaleTier = (index) => {
    const updated = [...wholesale_tiers];
    updated.splice(index, 1);
    setProductForm({ ...productForm, wholesale_tiers: updated });
  };

  return (
    <div className="fixed inset-0 z-50 glass flex items-center justify-center p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white dark:bg-darkbg-card border border-darkbg-border overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-darkbg-border flex items-center justify-between bg-gray-50 dark:bg-gray-850/20">
          <h3 className="font-extrabold text-sm text-gray-800 dark:text-white">
            {editingProduct ? `Edit Product: ${editingProduct.id}` : 'Create New Product'}
          </h3>
          <button onClick={() => setProductModalOpen(false)} className="p-1 rounded bg-gray-850 text-gray-500 hover:text-white">✕</button>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleProductFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-8 text-xs text-slate-300">
          
          {/* SECTION 1: SPESIFIKASI UMUM */}
          <div className="space-y-4">
            <h4 className="font-extrabold text-brand-400 text-sm border-b border-darkbg-border pb-2">🏢 Informasi Utama Produk</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Product ID (Unique, cth: MK-001)</span>
                <input
                  type="text"
                  required
                  disabled={!!editingProduct}
                  value={productForm.id}
                  onChange={(e) => setProductForm({ ...productForm, id: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-850 border border-darkbg-border focus:outline-none focus:border-brand-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Nama Produk</span>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-850 border border-darkbg-border focus:outline-none focus:border-brand-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Kategori</span>
                <select
                  required
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value, sub_category: '' })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-850 border border-darkbg-border focus:outline-none focus:border-brand-500 transition"
                >
                  <option value="">-- Pilih Kategori --</option>
                  <option value="Mukena">Mukena</option>
                  <option value="Hijab">Hijab</option>
                  <option value="Label">Label</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Sub Kategori</span>
                <select
                  required
                  value={productForm.sub_category}
                  onChange={(e) => setProductForm({ ...productForm, sub_category: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-850 border border-darkbg-border focus:outline-none focus:border-brand-500 transition"
                >
                  <option value="">-- Pilih Sub-Kategori --</option>
                  {subCategoryOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Bahan / Material</span>
                <input
                  type="text"
                  value={productForm.material || ''}
                  onChange={(e) => setProductForm({ ...productForm, material: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-850 border border-darkbg-border focus:outline-none focus:border-brand-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Status Ketersediaan</span>
                <select
                  required
                  value={productForm.status}
                  onChange={(e) => setProductForm({ ...productForm, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-850 border border-darkbg-border focus:outline-none focus:border-brand-500 transition"
                >
                  <option value="Tersedia">Tersedia</option>
                  <option value="Habis">Habis</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Deskripsi Produk</span>
              <textarea
                rows="2"
                value={productForm.description || ''}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-850 border border-darkbg-border focus:outline-none focus:border-brand-500 transition resize-none"
              />
            </div>
          </div>

          {/* SECTION 2: STANDAR HARGA, STOK & BERAT */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-darkbg-border pb-2">
              <h4 className="font-extrabold text-brand-400 text-sm">💰 Harga & Stok Default</h4>
              <span className="text-[9px] text-gray-500 font-semibold">(Berlaku jika produk tidak memiliki variasi khusus di bawah)</span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Harga Retail (Rp)</span>
                <input
                  type="number"
                  min="0"
                  required
                  value={productForm.price_retail}
                  onChange={(e) => setProductForm({ ...productForm, price_retail: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-850 border border-darkbg-border focus:outline-none focus:border-brand-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Harga Reseller (Rp)</span>
                <input
                  type="number"
                  min="0"
                  required
                  value={productForm.price_reseller}
                  onChange={(e) => setProductForm({ ...productForm, price_reseller: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-850 border border-darkbg-border focus:outline-none focus:border-brand-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Berat Default (Gram)</span>
                <input
                  type="number"
                  min="0"
                  required
                  value={productForm.weight}
                  onChange={(e) => setProductForm({ ...productForm, weight: parseInt(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-850 border border-darkbg-border focus:outline-none focus:border-brand-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Stok Default</span>
                <input
                  type="number"
                  min="0"
                  required
                  value={productForm.stock}
                  onChange={(e) => setProductForm({ ...productForm, stock: parseInt(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-850 border border-darkbg-border focus:outline-none focus:border-brand-500 transition"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: MULTI VARIAN / JENIS (TASK 1) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-darkbg-border pb-2">
              <h4 className="font-extrabold text-brand-400 text-sm flex items-center space-x-1.5">
                <span>🎨 Variasi / Jenis Produk ({variants.length})</span>
              </h4>
              <button
                type="button"
                onClick={handleAddVariant}
                className="px-3 py-1.5 rounded-lg bg-brand-600/20 text-brand-400 border border-brand-500/20 hover:bg-brand-600 hover:text-white font-extrabold text-[10px] transition"
              >
                ➕ Tambah Varian Baru
              </button>
            </div>

            {variants.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-darkbg-border bg-gray-850/10 text-center text-gray-500 font-semibold">
                Produk ini tidak memiliki variasi khusus (menggunakan harga & stok default).
              </div>
            ) : (
              <div className="space-y-5">
                {variants.map((v, vIdx) => (
                  <div key={v.id || vIdx} className="p-4 rounded-xl border border-darkbg-border bg-gray-850/20 space-y-4 relative group">
                    <button
                      type="button"
                      onClick={() => handleRemoveVariant(vIdx)}
                      className="absolute top-4 right-4 p-1.5 text-rose-500 bg-rose-500/10 hover:bg-rose-500 hover:text-white rounded-lg transition"
                      title="Hapus Varian"
                    >
                      ✕
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[9px] text-gray-500 font-extrabold uppercase">Nama Varian / Jenis (cth: Sutra Renda, Hijab Voal A)</span>
                        <input
                          type="text"
                          required
                          value={v.name}
                          placeholder="cth: Sutra Renda"
                          onChange={(e) => handleUpdateVariant(vIdx, 'name', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-gray-850 border border-darkbg-border focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Default Variant Pricings if Sizes empty */}
                    {(!v.sizes || v.sizes.length === 0) && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-gray-900/30 rounded-lg border border-darkbg-border/60">
                        <div className="space-y-1">
                          <span className="text-[9px] text-gray-500 font-bold uppercase">Harga Retail (Rp)</span>
                          <input
                            type="number"
                            min="0"
                            required
                            value={v.price_retail}
                            onChange={(e) => handleUpdateVariant(vIdx, 'price_retail', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-1.5 rounded bg-gray-850 border border-darkbg-border focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] text-gray-500 font-bold uppercase">Harga Reseller (Rp)</span>
                          <input
                            type="number"
                            min="0"
                            required
                            value={v.price_reseller}
                            onChange={(e) => handleUpdateVariant(vIdx, 'price_reseller', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-1.5 rounded bg-gray-850 border border-darkbg-border focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] text-gray-500 font-bold uppercase">Stok Varian</span>
                          <input
                            type="number"
                            min="0"
                            required
                            value={v.stock}
                            onChange={(e) => handleUpdateVariant(vIdx, 'stock', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-1.5 rounded bg-gray-850 border border-darkbg-border focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] text-gray-500 font-bold uppercase">Berat (Gram)</span>
                          <input
                            type="number"
                            min="0"
                            required
                            value={v.weight}
                            onChange={(e) => handleUpdateVariant(vIdx, 'weight', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-1.5 rounded bg-gray-850 border border-darkbg-border focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* SIZES UNDER VARIANTS SUB-GRID */}
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between border-t border-dashed border-darkbg-border/60 pt-3">
                        <span className="text-[9.5px] text-indigo-400 font-extrabold uppercase tracking-wider">📐 Ukuran & Harga Spesifik varian</span>
                        <button
                          type="button"
                          onClick={() => handleAddSizeToVariant(vIdx)}
                          className="px-2.5 py-1 rounded bg-indigo-500/10 hover:bg-indigo-600 text-indigo-400 hover:text-white font-extrabold text-[9px] border border-indigo-500/10 transition"
                        >
                          ➕ Tambah Ukuran Spesifik
                        </button>
                      </div>

                      {v.sizes && v.sizes.length > 0 && (
                        <div className="overflow-x-auto rounded-lg border border-darkbg-border bg-gray-900/40">
                          <table className="w-full text-left text-[10px] min-w-[500px]">
                            <thead>
                              <tr className="bg-gray-800/40 text-gray-400 font-bold border-b border-darkbg-border">
                                <th className="p-2.5 w-1/5">Ukuran (cth: S, M, Jumbo)</th>
                                <th className="p-2.5">Harga Retail (Rp)</th>
                                <th className="p-2.5">Harga Reseller (Rp)</th>
                                <th className="p-2.5 w-20">Stok</th>
                                <th className="p-2.5 w-24">Berat (Gram)</th>
                                <th className="p-2.5 text-center w-12">Hapus</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-darkbg-border/40">
                              {v.sizes.map((sz, szIdx) => (
                                <tr key={sz.id || szIdx}>
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      required
                                      value={sz.size}
                                      placeholder="cth: Standard"
                                      onChange={(e) => handleUpdateVariantSize(vIdx, szIdx, 'size', e.target.value)}
                                      className="w-full px-2 py-1.5 rounded bg-gray-850 border border-darkbg-border text-center"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="number"
                                      min="0"
                                      required
                                      value={sz.price_retail}
                                      onChange={(e) => handleUpdateVariantSize(vIdx, szIdx, 'price_retail', parseFloat(e.target.value) || 0)}
                                      className="w-full px-2 py-1.5 rounded bg-gray-850 border border-darkbg-border"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="number"
                                      min="0"
                                      required
                                      value={sz.price_reseller}
                                      onChange={(e) => handleUpdateVariantSize(vIdx, szIdx, 'price_reseller', parseFloat(e.target.value) || 0)}
                                      className="w-full px-2 py-1.5 rounded bg-gray-850 border border-darkbg-border"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="number"
                                      min="0"
                                      required
                                      value={sz.stock}
                                      onChange={(e) => handleUpdateVariantSize(vIdx, szIdx, 'stock', parseInt(e.target.value) || 0)}
                                      className="w-full px-2 py-1.5 rounded bg-gray-850 border border-darkbg-border text-center"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="number"
                                      min="0"
                                      required
                                      value={sz.weight}
                                      onChange={(e) => handleUpdateVariantSize(vIdx, szIdx, 'weight', parseInt(e.target.value) || 0)}
                                      className="w-full px-2 py-1.5 rounded bg-gray-850 border border-darkbg-border text-center"
                                    />
                                  </td>
                                  <td className="p-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveVariantSize(vIdx, szIdx)}
                                      className="p-1 text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-500 rounded"
                                    >
                                      ✕
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 4: TIERED QUANTITY WHOLESALE PRICES (TASK 1) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-darkbg-border pb-2">
              <h4 className="font-extrabold text-brand-400 text-sm">📈 Aturan Diskon Grosir / Kuantitas (Tiered Pricing)</h4>
              <button
                type="button"
                onClick={handleAddWholesaleTier}
                className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white font-extrabold text-[10px] transition"
              >
                ➕ Tambah Aturan Grosir
              </button>
            </div>

            {wholesale_tiers.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-darkbg-border bg-gray-850/10 text-center text-gray-500 font-semibold">
                Belum ada aturan diskon grosir bertingkat untuk produk ini.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-darkbg-border bg-gray-950/40">
                <table className="w-full text-left text-[10px] min-w-[500px]">
                  <thead>
                    <tr className="bg-gray-800/40 text-gray-400 font-bold border-b border-darkbg-border">
                      <th className="p-2.5 w-24 text-center">Min Qty (Pcs)</th>
                      <th className="p-2.5 w-24 text-center">Max Qty (Pcs)</th>
                      <th className="p-2.5">Harga Grosir Retail (Rp)</th>
                      <th className="p-2.5">Harga Grosir Reseller (Rp)</th>
                      <th className="p-2.5 text-center w-12">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-darkbg-border/40">
                    {wholesale_tiers.map((tier, idx) => (
                      <tr key={tier.id || idx}>
                        <td className="p-2">
                          <input
                            type="number"
                            min="2"
                            required
                            value={tier.min_qty}
                            onChange={(e) => handleUpdateWholesaleTier(idx, 'min_qty', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 rounded bg-gray-850 border border-darkbg-border text-center"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="2"
                            placeholder="Tak Terbatas"
                            value={tier.max_qty || ''}
                            onChange={(e) => handleUpdateWholesaleTier(idx, 'max_qty', e.target.value ? parseInt(e.target.value) : '')}
                            className="w-full px-2 py-1.5 rounded bg-gray-850 border border-darkbg-border text-center"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            required
                            value={tier.price_retail}
                            onChange={(e) => handleUpdateWholesaleTier(idx, 'price_retail', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 rounded bg-gray-850 border border-darkbg-border"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            required
                            value={tier.price_reseller}
                            onChange={(e) => handleUpdateWholesaleTier(idx, 'price_reseller', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 rounded bg-gray-850 border border-darkbg-border"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveWholesaleTier(idx)}
                            className="p-1 text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-500 rounded"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECTION 5: IMAGE GALLERY MANAGER */}
          <div className="space-y-4">
            <h4 className="font-extrabold text-brand-400 text-sm border-b border-darkbg-border pb-2">📸 Galeri Gambar Produk</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <span className="text-[10px] text-gray-500 font-extrabold uppercase">Unggah Gambar Produk Baru</span>
                <button
                  type="button"
                  onClick={() => imgInputRef.current.click()}
                  disabled={uploadingImage}
                  className="w-full py-3.5 rounded-xl bg-gray-850 border border-dashed border-darkbg-border text-xs text-gray-400 font-bold hover:text-white transition"
                >
                  {uploadingImage ? 'Mengunggah...' : 'Pilih File Gambar'}
                </button>
                <input
                  type="file"
                  ref={imgInputRef}
                  onChange={handleProductImageUpload}
                  accept="image/*"
                  className="hidden"
                />

                <div className="space-y-1 text-[10px] pt-1">
                  <span className="text-gray-500 font-semibold uppercase">Atau URL Gambar</span>
                  <input
                    type="text"
                    placeholder="Masukkan URL gambar lalu tekan Enter..."
                    value={productForm.image}
                    onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-850 border border-darkbg-border text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Dynamic Multi-Image Gallery Manager */}
              <div className="rounded-xl bg-gray-850 border border-darkbg-border p-3.5 space-y-2">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                  Daftar Gambar Terunggah ({productForm.image ? productForm.image.split(',').filter(Boolean).length : 0})
                </span>
                <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
                  {productForm.image && productForm.image.split(',').map(i => i.trim()).filter(Boolean).length > 0 ? (
                    productForm.image.split(',').map((imgUrl, idx) => {
                      const cleanUrl = imgUrl.trim();
                      if (!cleanUrl) return null;
                      return (
                        <div key={idx} className="relative h-16 rounded-lg overflow-hidden bg-gray-900 border border-darkbg-border group">
                          <img src={cleanUrl} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              const list = productForm.image.split(',').map(i => i.trim()).filter(Boolean);
                              list.splice(idx, 1);
                              setProductForm({ ...productForm, image: list.join(', ') });
                            }}
                            className="absolute inset-0 bg-rose-600/90 text-white font-extrabold text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-lg"
                          >
                            Hapus
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-full text-center text-[10px] text-gray-500 py-6">Belum ada gambar terunggah.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions Footer */}
          <div className="pt-4 border-t border-darkbg-border flex items-center justify-end space-x-3 shrink-0">
            <button
              type="button"
              onClick={() => setProductModalOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-gray-850 hover:bg-gray-800 font-bold text-xs text-gray-400 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 font-extrabold text-xs text-white shadow-lg transition"
            >
              Save Product
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
