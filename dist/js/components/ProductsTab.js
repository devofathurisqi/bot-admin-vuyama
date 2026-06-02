// Skeleton Loader Grid Component
const SkeletonGrid = () => {
  return (
    <React.Fragment>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="rounded-3xl bg-white dark:bg-darkbg-card border border-gray-100 dark:border-darkbg-border overflow-hidden shadow-sm flex flex-col justify-between h-[520px]">
          <div className="h-72 w-full bg-gray-200 dark:bg-gray-800 animate-pulse rounded-t-3xl" />
          <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="h-3 w-1/4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              <div className="space-y-1.5 pt-1">
                <div className="h-3.5 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                <div className="h-3.5 w-5/6 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              </div>
            </div>
            <div className="space-y-3 pt-4 border-t border-darkbg-border">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="h-2 w-12 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                  <div className="h-4.5 w-20 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-2 w-12 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                  <div className="h-4.5 w-20 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="h-3.5 w-20 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                <div className="h-3.5 w-16 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              </div>
            </div>
          </div>
          <div className="p-4 bg-gray-50/50 dark:bg-gray-800/10 border-t border-darkbg-border flex justify-end space-x-3 rounded-b-3xl">
            <div className="h-8 w-8 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
            <div className="h-8 w-8 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
          </div>
        </div>
      ))}
    </React.Fragment>
  );
};

// Premium Individual Product Card with Carousel and Lazy Loading
const ProductCard = ({ p, handleEditProductClick, handleDeleteProduct }) => {
  const [currentImgIndex, setCurrentImgIndex] = React.useState(0);
  const images = p.image ? p.image.split(',').map(img => img.trim()).filter(Boolean) : [];
  const variantsList = p.variants || [];
  const tiersList = p.wholesale_tiers || [];

  const handlePrev = (e) => {
    e.stopPropagation();
    if (currentImgIndex > 0) {
      setCurrentImgIndex(currentImgIndex - 1);
    }
  };

  const handleNext = (e) => {
    e.stopPropagation();
    if (currentImgIndex < images.length - 1) {
      setCurrentImgIndex(currentImgIndex + 1);
    }
  };

  return (
    <div className="rounded-3xl bg-white dark:bg-darkbg-card border border-gray-100 dark:border-darkbg-border overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 relative group text-gray-800 dark:text-gray-200 h-[520px]">
      
      {/* PRODUCT IMAGE OR CAROUSEL */}
      <div className="h-72 w-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center overflow-hidden border-b border-darkbg-border relative select-none">
        {images.length > 0 ? (
          <React.Fragment>
            {/* Active Image with Lazy Load and smooth transitions */}
             <window.ImageWithSkeleton 
              src={images[currentImgIndex]} 
              alt={`${p.name} - ${currentImgIndex + 1}`} 
              className="w-full h-full object-contain p-4 transition-all duration-500 scale-100 group-hover:scale-[1.02]" 
            />

            {/* Left Chevron Arrow Button (Airbnb style) */}
            {currentImgIndex > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-gray-800 flex items-center justify-center shadow-lg transition-all duration-200 z-10 opacity-0 group-hover:opacity-100 scale-90 hover:scale-100"
              >
                <svg className="w-4 h-4 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Right Chevron Arrow Button (Airbnb style) */}
            {currentImgIndex < images.length - 1 && (
              <button
                type="button"
                onClick={handleNext}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-gray-800 flex items-center justify-center shadow-lg transition-all duration-200 z-10 opacity-0 group-hover:opacity-100 scale-90 hover:scale-100"
              >
                <svg className="w-4 h-4 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* Indicator Dots (Airbnb style) */}
            {images.length > 1 && (
              <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 bg-black/35 px-2.5 py-1 rounded-full backdrop-blur-[2px]">
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCurrentImgIndex(idx); }}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${idx === currentImgIndex ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/80'}`}
                  />
                ))}
              </div>
            )}
          </React.Fragment>
        ) : (
          <div className="text-gray-400 font-bold uppercase text-[10px] tracking-widest select-none">No Preview Image</div>
        )}

        {/* Status Badge */}
        <span className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wide shadow-sm backdrop-blur-md ${p.status === 'Tersedia' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
          {p.status}
        </span>

        {/* Extra variants & tiers indicators */}
        <div className="absolute top-4 left-4 flex flex-col gap-1.5">
          {variantsList.length > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-indigo-600/90 text-white font-extrabold text-[8px] uppercase tracking-wider shadow border border-indigo-500/10">
              🎨 {variantsList.length} Varian
            </span>
          )}
          {tiersList.length > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-600/90 text-white font-extrabold text-[8px] uppercase tracking-wider shadow border border-emerald-500/10">
              📈 Wholesale
            </span>
          )}
        </div>
      </div>

      {/* PRODUCT DETAILS */}
      <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-brand-600 dark:text-brand-400 font-extrabold uppercase tracking-widest">{p.category}</span>
            <span className="text-gray-300 dark:text-gray-700 font-extrabold text-[10px]">•</span>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{p.sub_category || 'General'}</span>
          </div>
          <h3 className="font-extrabold text-base leading-snug line-clamp-2 text-slate-800 dark:text-white animate-fade-in" title={p.name}>{p.name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{p.description || 'Tidak ada deskripsi.'}</p>
        </div>

        <div className="space-y-3 pt-4 border-t border-darkbg-border">
          {/* PRICINGS */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-400 dark:text-gray-500 font-bold uppercase text-[8px] tracking-widest block mb-0.5">Retail Price</span>
              <p className="font-extrabold text-base text-gray-800 dark:text-gray-100">
                {variantsList.length > 0 ? (
                  <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-850 px-2 py-0.5 rounded font-bold">Multi-varian</span>
                ) : (
                  `Rp ${p.price_retail.toLocaleString('id-ID')}`
                )}
              </p>
            </div>
            <div>
              <span className="text-gray-400 dark:text-gray-500 font-bold uppercase text-[8px] tracking-widest block mb-0.5">Reseller Price</span>
              <p className="font-extrabold text-base text-brand-600 dark:text-brand-400">
                {variantsList.length > 0 ? (
                  <span className="text-xs text-brand-400/80 bg-brand-500/5 px-2 py-0.5 rounded font-bold">Multi-varian</span>
                ) : (
                  `Rp ${p.price_reseller.toLocaleString('id-ID')}`
                )}
              </p>
            </div>
          </div>

          {/* SPECIFICS */}
          <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 font-bold tracking-wider pt-1">
            <span>
              Stok:{' '}
              <strong className="text-gray-700 dark:text-gray-200 font-extrabold">
                {variantsList.length > 0 ? (
                  variantsList.reduce((acc, v) => acc + (v.sizes && v.sizes.length > 0 ? v.sizes.reduce((si, s) => si + (s.stock || 0), 0) : (v.stock || 0)), 0) + ' pcs (total)'
                ) : (
                  `${p.stock} pcs`
                )}
              </strong>
            </span>
            <span className="bg-gray-100 dark:bg-gray-850 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300 font-bold">{p.weight} gram</span>
          </div>
        </div>
      </div>

      {/* ACTIONS FOOTER BAR */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/10 border-t border-darkbg-border flex items-center justify-end space-x-2.5 shrink-0 rounded-b-3xl">
        <button 
          type="button"
          onClick={() => handleEditProductClick(p)} 
          className="p-2 rounded-xl bg-gray-200/80 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-white hover:bg-brand-600 transition duration-200 flex items-center justify-center"
          title="Penyuntingan Produk"
        >
          <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </button>
        <button 
          type="button"
          onClick={() => handleDeleteProduct(p.id)} 
          className="p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition duration-200 flex items-center justify-center"
          title="Hapus Produk"
        >
          <Icons.Trash />
        </button>
      </div>
    </div>
  );
};

// Main ProductsTab
window.ProductsTab = ({
  activeTab,
  products,
  productsLoading,
  productSearch,
  setProductSearch,
  productCategory,
  setProductCategory,
  productPage,
  setProductPage,
  productPagination,
  setEditingProduct,
  setProductForm,
  setProductModalOpen,
  handleEditProductClick,
  handleDeleteProduct
}) => {
  if (activeTab !== 'products') return null;

  // Safe pagination calculations to prevent crashes or infinite loops
  const totalItems = (productPagination && typeof productPagination.total === 'number') ? productPagination.total : 0;
  const paginationLimit = (productPagination && typeof productPagination.limit === 'number' && productPagination.limit > 0) ? productPagination.limit : 9;
  const currentPage = (productPagination && typeof productPagination.page === 'number') ? productPagination.page : 1;
  const totalPages = Math.ceil(totalItems / paginationLimit);
  const safePages = isFinite(totalPages) && totalPages > 0 ? totalPages : 1;

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
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-8 transition-opacity duration-200 ${productsLoading ? 'opacity-50 pointer-events-none' : ''}`}>
        {productsLoading && products.length === 0 ? (
          <SkeletonGrid />
        ) : (
          <React.Fragment>
            {products.map(p => (
              <ProductCard 
                key={p.id} 
                p={p} 
                handleEditProductClick={handleEditProductClick} 
                handleDeleteProduct={handleDeleteProduct} 
              />
            ))}
            {products.length === 0 && (
              <div className="col-span-full p-12 text-center text-gray-500 text-sm font-medium">Tidak ada produk ditemukan.</div>
            )}
          </React.Fragment>
        )}
      </div>

      {/* PAGINATION CONTROLS */}
      {totalItems > paginationLimit && (
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-darkbg-border pt-6 mt-8 gap-4 select-none">
          <span className="text-xs text-gray-500 font-medium">
            Showing <strong className="text-gray-800 dark:text-white font-extrabold">{((currentPage - 1) * paginationLimit) + 1}</strong> to <strong className="text-gray-800 dark:text-white font-extrabold">{Math.min(currentPage * paginationLimit, totalItems)}</strong> of <strong className="text-gray-800 dark:text-white font-extrabold">{totalItems}</strong> products
          </span>

          <div className="flex items-center space-x-2">
            {/* Prev Button */}
            <button
              type="button"
              onClick={() => setProductPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage <= 1}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-darkbg-card border border-gray-200 dark:border-darkbg-border font-bold text-xs hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition text-gray-700 dark:text-gray-300"
            >
              Previous
            </button>

            {/* Page Numbers */}
            {Array.from({ length: safePages }).map((_, idx) => {
              const pNum = idx + 1;
              return (
                <button
                  key={pNum}
                  type="button"
                  onClick={() => setProductPage(pNum)}
                  className={`w-9 h-9 rounded-xl font-bold text-xs transition flex items-center justify-center ${
                    currentPage === pNum
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-500/15'
                      : 'bg-white dark:bg-darkbg-card border border-gray-200 dark:border-darkbg-border text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {pNum}
                </button>
              );
            })}

            {/* Next Button */}
            <button
              type="button"
              onClick={() => setProductPage(prev => Math.min(prev + 1, safePages))}
              disabled={currentPage >= safePages}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-darkbg-card border border-gray-200 dark:border-darkbg-border font-bold text-xs hover:bg-gray-50 dark:hover:bg-gray-850 disabled:opacity-40 disabled:cursor-not-allowed transition text-gray-700 dark:text-gray-300"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
