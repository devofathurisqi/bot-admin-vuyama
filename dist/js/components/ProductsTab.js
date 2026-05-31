window.ProductsTab = ({
  activeTab,
  products,
  productSearch,
  setProductSearch,
  productCategory,
  setProductCategory,
  setEditingProduct,
  setProductForm,
  setProductModalOpen,
  handleEditProductClick,
  handleDeleteProduct
}) => {
  if (activeTab !== 'products') return null;

  return (
    <div className="space-y-6 text-xs text-slate-300">
      {/* BAR CONTROL HEADER */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-darkbg-border pb-5">
        <div className="space-y-1 self-start">
          <h2 className="text-xl font-extrabold font-sans text-gray-800 dark:text-white">Products Management</h2>
          <p className="text-xs text-gray-500 font-medium">Create products, manage retail/reseller pricing, update variants, sizes, stocks, or wholesale rules.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setEditingProduct(null);
              setProductForm({ 
                id: '', 
                name: '', 
                category: '', 
                sub_category: '', 
                description: '', 
                price_retail: '', 
                price_reseller: '', 
                color: '', 
                size: '', 
                material: '', 
                weight: '', 
                stock: '', 
                image: '', 
                status: 'Tersedia',
                variants: [],
                wholesale_tiers: []
              });
              setProductModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm shadow-lg shadow-brand-500/15 flex items-center space-x-2 transition"
          >
            <Icons.Plus />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* FILTER BAR & SEARCH */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500"><Icons.Search /></span>
          <input
            type="text"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder="Search product name, category, material..."
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-darkbg-card border border-gray-200 dark:border-darkbg-border font-medium text-sm focus:outline-none focus:border-brand-500 transition text-gray-800 dark:text-white"
          />
        </div>

        <select
          value={productCategory}
          onChange={(e) => setProductCategory(e.target.value)}
          className="px-4 py-3 rounded-xl bg-white dark:bg-darkbg-card border border-gray-200 dark:border-darkbg-border font-bold text-sm focus:outline-none transition text-gray-800 dark:text-white"
        >
          <option value="">All Categories</option>
          <option value="Mukena">Mukena</option>
          <option value="Hijab">Hijab / Kerudung</option>
          <option value="Label">Label Custom</option>
        </select>
      </div>

      {/* PRODUCTS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map(p => {
          const variantsList = p.variants || [];
          const tiersList = p.wholesale_tiers || [];

          return (
            <div key={p.id} className="rounded-2xl bg-white dark:bg-darkbg-card border border-gray-100 dark:border-darkbg-border overflow-hidden flex flex-col justify-between shadow-sm relative group text-gray-800 dark:text-gray-200">
              
              {/* PRODUCT IMAGE OR FALLBACK */}
              <div className="h-44 w-full bg-gray-100 dark:bg-gray-850 flex items-center justify-center overflow-hidden border-b border-darkbg-border relative">
                {(() => {
                  const images = p.image ? p.image.split(',').map(img => img.trim()).filter(Boolean) : [];
                  if (images.length > 0) {
                    return (
                      <React.Fragment>
                        <img src={images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 duration-300" />
                        {images.length > 1 && (
                          <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[9px] font-bold text-white shadow-sm border border-white/10">
                            📸 +{images.length - 1} Gambar
                          </span>
                        )}
                      </React.Fragment>
                    );
                  }
                  return (
                    <div className="text-gray-400 font-bold uppercase text-[10px] tracking-widest select-none">No Preview Image</div>
                  );
                })()}

                {/* Status Badge */}
                <span className={`absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${p.status === 'Tersedia' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                  {p.status}
                </span>

                {/* Extra variants & tiers indicators */}
                <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                  {variantsList.length > 0 && (
                    <span className="px-2 py-0.5 rounded bg-indigo-600/90 text-white font-extrabold text-[8px] uppercase tracking-wide shadow border border-indigo-500/10">
                      🎨 {variantsList.length} Varian
                    </span>
                  )}
                  {tiersList.length > 0 && (
                    <span className="px-2 py-0.5 rounded bg-emerald-600/90 text-white font-extrabold text-[8px] uppercase tracking-wide shadow border border-emerald-500/10">
                      📈 Wholesale
                    </span>
                  )}
                </div>
              </div>

              {/* PRODUCT DETAILS */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <span className="text-[10px] text-brand-500 font-extrabold uppercase tracking-wide">{p.category} ({p.sub_category || 'General'})</span>
                  <h3 className="font-extrabold text-sm leading-tight line-clamp-2" title={p.name}>{p.name}</h3>
                  <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">{p.description || 'Tidak ada deskripsi.'}</p>
                </div>

                <div className="space-y-3 pt-3 border-t border-darkbg-border">
                  {/* PRICINGS */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500 font-semibold uppercase text-[8px] tracking-wide">Retail Price</span>
                      <p className="font-bold text-gray-700 dark:text-gray-200">
                        {variantsList.length > 0 ? (
                          <span className="text-[10px] text-gray-400">Multi-variant</span>
                        ) : (
                          `Rp ${p.price_retail.toLocaleString('id-ID')}`
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 font-semibold uppercase text-[8px] tracking-wide">Reseller Price</span>
                      <p className="font-bold text-brand-400">
                        {variantsList.length > 0 ? (
                          <span className="text-[10px] text-brand-400">Multi-variant</span>
                        ) : (
                          `Rp ${p.price_reseller.toLocaleString('id-ID')}`
                        )}
                      </p>
                    </div>
                  </div>

                  {/* SPECIFICS */}
                  <div className="flex items-center justify-between text-[10px] text-gray-500 font-semibold">
                    <span>
                      Stok:{' '}
                      <strong className="text-gray-800 dark:text-gray-200 font-extrabold">
                        {variantsList.length > 0 ? (
                          variantsList.reduce((acc, v) => acc + (v.sizes && v.sizes.length > 0 ? v.sizes.reduce((si, s) => si + (s.stock || 0), 0) : (v.stock || 0)), 0) + ' pcs (total)'
                        ) : (
                          `${p.stock} pcs`
                        )}
                      </strong>
                    </span>
                    <span>{p.weight} gram</span>
                  </div>
                </div>
              </div>

              {/* ACTIONS FOOTER BAR */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800/40 border-t border-darkbg-border flex items-center justify-end space-x-2 shrink-0">
                <button 
                  onClick={() => handleEditProductClick(p)} 
                  className="p-2 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-white hover:bg-brand-600 transition"
                  title="Penyuntingan Produk"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button 
                  onClick={() => handleDeleteProduct(p.id)} 
                  className="p-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition"
                  title="Hapus Produk"
                >
                  <Icons.Trash />
                </button>
              </div>
            </div>
          );
        })}

        {products.length === 0 && (
          <div className="col-span-full p-12 text-center text-gray-500">Tidak ada produk ditemukan.</div>
        )}
      </div>
    </div>
  );
};
