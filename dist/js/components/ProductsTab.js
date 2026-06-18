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
                  <div className="h-4 w-20 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-2 w-12 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                  <div className="h-4 w-20 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
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
const ProductCard = ({ p, handleEditProductClick, handleDeleteProduct, onOpenDetail }) => {
  const [currentImgIndex, setCurrentImgIndex] = React.useState(0);
  const images = p.image ? p.image.split(',').map(img => img.trim()).filter(Boolean) : [];
  let variantsList = [];
  try {
    variantsList = Array.isArray(p.variants) ? p.variants : (typeof p.variants === 'string' ? JSON.parse(p.variants || '[]') : []);
  } catch (e) {
    variantsList = [];
  }
  if (!Array.isArray(variantsList)) variantsList = [];

  let tiersList = [];
  try {
    tiersList = Array.isArray(p.wholesale_tiers) ? p.wholesale_tiers : (typeof p.wholesale_tiers === 'string' ? JSON.parse(p.wholesale_tiers || '[]') : []);
  } catch (e) {
    tiersList = [];
  }
  if (!Array.isArray(tiersList)) tiersList = [];

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
    <div 
      onDoubleClick={() => onOpenDetail(p.id)}
      className="rounded-3xl bg-white dark:bg-darkbg-card border border-gray-100 dark:border-darkbg-border overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 relative group text-gray-800 dark:text-gray-200 h-[520px] cursor-pointer"
    >
      
      {/* PRODUCT IMAGE OR CAROUSEL */}
      <div className="h-72 w-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center overflow-hidden border-b border-darkbg-border relative select-none">
        {images.length > 0 ? (
          <React.Fragment>
            {/* Active Image with Lazy Load and smooth transitions */}
             <img 
              src={images[currentImgIndex]} 
              alt={`${p.name} - ${currentImgIndex + 1}`} 
              loading="lazy"
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
          <h3 className="font-extrabold text-base leading-snug line-clamp-2 text-slate-800 dark:text-white" title={p.name}>{p.name}</h3>
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
          onClick={(e) => { e.stopPropagation(); onOpenDetail(p.id); }} 
          className="px-3.5 py-2 rounded-xl bg-gray-200/80 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-white transition duration-200 flex items-center space-x-1 font-bold text-[10px] uppercase tracking-wider"
          title="Detail Produk & Warna"
        >
          <span>Detail</span>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
        </button>
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); handleEditProductClick(p); }} 
          className="p-2 rounded-xl bg-gray-200/80 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-white hover:bg-brand-600 transition duration-200 flex items-center justify-center"
          title="Penyuntingan Produk"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </button>
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); handleDeleteProduct(p.id); }} 
          className="p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition duration-200 flex items-center justify-center"
          title="Hapus Produk"
        >
          <Icons.Trash className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Premium Product Detail Page Component
const ProductDetailPage = ({
  product,
  onBack,
  handleEditProductClick,
  handleDeleteProduct,
  stockColors,
  handleCreateStockColor,
  handleToggleStockColorStatus,
  handleDeleteStockColor,
  handleSyncKnowledge,
  fetchStockColors
}) => {
  const [currentImgIndex, setCurrentImgIndex] = React.useState(0);
  const [isColorFormOpen, setIsColorFormOpen] = React.useState(false);
  const [newColorName, setNewColorName] = React.useState('');
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [uploadingColor, setUploadingColor] = React.useState(false);
  const colorFileInputRef = React.useRef(null);

  const images = product.image ? product.image.split(',').map(img => img.trim()).filter(Boolean) : [];
  
  let variantsList = [];
  try {
    variantsList = Array.isArray(product.variants) ? product.variants : (typeof product.variants === 'string' ? JSON.parse(product.variants || '[]') : []);
  } catch (e) {
    variantsList = [];
  }

  let tiersList = [];
  try {
    tiersList = Array.isArray(product.wholesale_tiers) ? product.wholesale_tiers : (typeof product.wholesale_tiers === 'string' ? JSON.parse(product.wholesale_tiers || '[]') : []);
  } catch (e) {
    tiersList = [];
  }

  // Filter stock colors specific to this product
  const productColors = React.useMemo(() => {
    return stockColors.filter(c => c.product_id === product.id);
  }, [stockColors, product.id]);

  const handleCreateSwatch = async (e) => {
    e.preventDefault();
    const originalFile = colorFileInputRef.current?.files[0];
    if (!originalFile) {
      alert('Gambar swatch warna wajib diunggah!');
      return;
    }

    setUploadingColor(true);

    try {
      const compressedFile = await window.compressImage(originalFile);
      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('color_name', 'Stok Warna');
      formData.append('category', product.category || 'Mukena');
      formData.append('product_id', product.id);
      formData.append('is_ready', 'true');

      await handleCreateStockColor(formData);
    } catch (err) {
      // Handled inside handleCreateStockColor
    } finally {
      setUploadingColor(false);
      setIsColorFormOpen(false);
      if (colorFileInputRef.current) colorFileInputRef.current.value = '';
      fetchStockColors();
    }
  };

  const handleSyncClick = async () => {
    setIsSyncing(true);
    await handleSyncKnowledge();
    setIsSyncing(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Detail Header bar */}
      <div className="flex items-center justify-between border-b border-darkbg-border pb-5 gap-4">
        <div className="flex items-center space-x-3.5">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-white dark:bg-darkbg-card border border-gray-200 dark:border-darkbg-border text-gray-500 hover:text-gray-800 dark:hover:text-white transition shadow-sm hover:shadow"
            title="Kembali ke Daftar Produk"
          >
            <Icons.ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-[10px] text-brand-600 dark:text-brand-400 font-extrabold uppercase tracking-widest">{product.category}</span>
            <h2 className="text-xl font-extrabold text-gray-800 dark:text-white truncate max-w-lg md:max-w-xl">{product.name}</h2>
          </div>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => handleEditProductClick(product)}
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-darkbg-card border border-gray-200 dark:border-darkbg-border text-gray-700 dark:text-gray-300 font-bold text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition flex items-center space-x-2 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            <span>Edit</span>
          </button>
          <button
            onClick={() => { handleDeleteProduct(product.id); onBack(); }}
            className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs transition flex items-center space-x-2 shadow-md shadow-rose-500/10"
          >
            <Icons.Trash className="w-4 h-4" />
            <span>Hapus</span>
          </button>
        </div>
      </div>

      {/* Grid Split Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Media & Product Details (5 columns) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl bg-white dark:bg-darkbg-card border border-gray-150 dark:border-darkbg-border overflow-hidden shadow-sm flex flex-col p-6 space-y-5">
            {/* Carousel display box */}
            <div className="h-80 w-full bg-gray-50 dark:bg-gray-950 flex items-center justify-center overflow-hidden rounded-2xl relative select-none border border-darkbg-border">
              {images.length > 0 ? (
                <React.Fragment>
                  <img
                    src={images[currentImgIndex]}
                    alt={`${product.name} - ${currentImgIndex + 1}`}
                    loading="lazy"
                    className="w-full h-full object-contain p-4"
                  />
                  {currentImgIndex > 0 && (
                    <button
                      onClick={() => setCurrentImgIndex(currentImgIndex - 1)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 dark:bg-gray-800/90 text-gray-800 dark:text-white flex items-center justify-center shadow-lg transition duration-200"
                    >
                      ❮
                    </button>
                  )}
                  {currentImgIndex < images.length - 1 && (
                    <button
                      onClick={() => setCurrentImgIndex(currentImgIndex + 1)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 dark:bg-gray-800/90 text-gray-800 dark:text-white flex items-center justify-center shadow-lg transition duration-200"
                    >
                      ❯
                    </button>
                  )}
                </React.Fragment>
              ) : (
                <div className="text-gray-400 font-bold uppercase text-[10px] tracking-widest select-none">No Preview Image</div>
              )}
            </div>

            {/* Carousel dots indicators */}
            {images.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImgIndex(idx)}
                    className={`w-2.5 h-2.5 rounded-full transition ${idx === currentImgIndex ? 'bg-brand-600 scale-125' : 'bg-gray-300 dark:bg-gray-700 hover:bg-gray-400'}`}
                  />
                ))}
              </div>
            )}

            {/* Product description */}
            <div className="space-y-2.5">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-white uppercase tracking-wider border-b border-darkbg-border pb-2">Deskripsi Produk</h3>
              <p className="text-xs text-gray-600 dark:text-gray-450 leading-relaxed whitespace-pre-line">
                {product.description || 'Tidak ada deskripsi produk.'}
              </p>
            </div>

            {/* Spec grid */}
            <div className="border-t border-darkbg-border pt-4 grid grid-cols-2 gap-4 text-xs font-semibold text-gray-500 dark:text-gray-400">
              <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-darkbg-border">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Category</span>
                <strong className="text-gray-800 dark:text-white font-extrabold text-sm">{product.category}</strong>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-darkbg-border">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Sub Category</span>
                <strong className="text-gray-800 dark:text-white font-extrabold text-sm">{product.sub_category || 'Umum'}</strong>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-darkbg-border">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Retail Price</span>
                <strong className="text-brand-600 dark:text-brand-400 font-extrabold text-sm">
                  {variantsList.length > 0 ? 'Multi-varian' : `Rp ${product.price_retail.toLocaleString('id-ID')}`}
                </strong>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-darkbg-border">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Reseller Price</span>
                <strong className="text-brand-600 dark:text-brand-400 font-extrabold text-sm">
                  {variantsList.length > 0 ? 'Multi-varian' : `Rp ${product.price_reseller.toLocaleString('id-ID')}`}
                </strong>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-darkbg-border">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Total Stok</span>
                <strong className="text-gray-850 dark:text-gray-200 font-extrabold text-sm">
                  {variantsList.length > 0 ? (
                    variantsList.reduce((acc, v) => acc + (v.sizes && v.sizes.length > 0 ? v.sizes.reduce((si, s) => si + (s.stock || 0), 0) : (v.stock || 0)), 0) + ' pcs'
                  ) : (
                    `${product.stock} pcs`
                  )}
                </strong>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-darkbg-border">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Berat / Material</span>
                <strong className="text-gray-850 dark:text-gray-200 font-extrabold text-sm">
                  {product.weight}g / {product.material || '-'}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Colors Swatches Board (7 columns) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-3xl bg-white dark:bg-darkbg-card border border-gray-150 dark:border-darkbg-border overflow-hidden shadow-sm p-6 space-y-5">
            
            {/* Swatch Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-darkbg-border pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center space-x-2">
                  <Icons.Palette className="w-5 h-5 text-indigo-500" />
                  <span>Color Swatches ({productColors.length})</span>
                </h3>
                <p className="text-[10px] text-gray-500 font-medium">Manage daily fabric stock colors specifically for this product.</p>
              </div>

              <div className="flex items-center space-x-2 self-end sm:self-auto">
                <button
                  onClick={handleSyncClick}
                  disabled={isSyncing}
                  className="px-3.5 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500 text-indigo-650 dark:text-indigo-400 hover:text-white border border-indigo-500/20 font-bold text-[10px] uppercase tracking-wider transition flex items-center space-x-1.5 disabled:opacity-50"
                  title="Sync Swatches to AI Database"
                >
                  <Icons.Refresh className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sync AI</span>
                </button>
                <button
                  onClick={() => setIsColorFormOpen(!isColorFormOpen)}
                  className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-[10px] uppercase tracking-wider transition flex items-center space-x-1 shadow shadow-brand-500/10"
                >
                  <span>Add Swatch</span>
                  <Icons.Plus className={`w-3.5 h-3.5 transform transition duration-200 ${isColorFormOpen ? 'rotate-45' : ''}`} />
                </button>
              </div>
            </div>

            {/* Toggleable Swatch Upload Form */}
            {isColorFormOpen && (
              <form onSubmit={handleCreateSwatch} className="p-5 rounded-2xl border border-indigo-100 dark:border-darkbg-border bg-indigo-50/25 dark:bg-gray-900/20 space-y-4 max-w-xl animate-fadeIn">
                <h4 className="font-extrabold text-xs text-brand-600 dark:text-brand-400 uppercase tracking-wider leading-none">Add Fabric Swatch Color</h4>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Upload Swatch Photo</label>
                  <input
                    type="file"
                    required
                    disabled={uploadingColor}
                    ref={colorFileInputRef}
                    accept="image/*"
                    className="text-xs text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:bg-gray-200 file:dark:bg-gray-800 file:text-gray-700 file:dark:text-white hover:file:bg-brand-500/10 cursor-pointer w-full"
                  />
                </div>

                <button
                  type="submit"
                  disabled={uploadingColor}
                  className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold text-xs tracking-wider uppercase transition shadow-md shadow-brand-500/15 flex items-center justify-center space-x-2"
                >
                  {uploadingColor ? (
                    <React.Fragment>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Mengunggah...</span>
                    </React.Fragment>
                  ) : (
                    <span>Save Color Swatch</span>
                  )}
                </button>
              </form>
            )}

            {/* Swatches Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {productColors.map(color => (
                <div
                  key={color.id}
                  className="group relative rounded-2xl border border-darkbg-border bg-white dark:bg-darkbg-card overflow-hidden shadow-sm flex flex-col justify-between transition duration-300 hover:shadow-md h-[200px]"
                >
                  {/* Fabric image box */}
                  <div className="flex-1 bg-slate-900 flex items-center justify-center overflow-hidden relative select-none">
                    <img
                      src={color.image_path}
                      alt="Color Swatch"
                      loading="lazy"
                      className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  </div>

                  {/* Action controls */}
                  <div className="p-2 bg-gray-50 dark:bg-gray-850/20 flex items-center justify-end shrink-0 border-t border-darkbg-border">
                    <button
                      onClick={() => handleDeleteStockColor(color.id)}
                      className="w-full py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white transition duration-200 flex items-center justify-center space-x-1 font-bold text-[10px] uppercase tracking-wider"
                      title="Hapus Warna"
                    >
                      <Icons.Trash className="w-3.5 h-3.5" />
                      <span>Hapus Warna</span>
                    </button>
                  </div>
                </div>
              ))}

              {productColors.length === 0 && (
                <div className="col-span-full py-12 px-4 text-center border border-dashed border-darkbg-border rounded-2xl flex flex-col items-center justify-center space-y-2 text-gray-500">
                  <Icons.Palette className="w-8 h-8 text-gray-400 animate-pulse" />
                  <p className="font-medium text-xs">Belum ada pilihan warna swatch untuk produk ini.</p>
                  <p className="text-[10px] text-gray-400">Gunakan tombol 'Add Swatch' di atas untuk mengunggah.</p>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};

// Main ProductsTab Component
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
  handleDeleteProduct,
  stockColors,
  handleCreateStockColor,
  handleToggleStockColorStatus,
  handleDeleteStockColor,
  handleSyncKnowledge,
  fetchStockColors
}) => {
  const [selectedProductId, setSelectedProductId] = React.useState(null);

  if (activeTab !== 'products') return null;

  // Safe pagination calculations
  const totalItems = (productPagination && typeof productPagination.total === 'number') ? productPagination.total : 0;
  const paginationLimit = (productPagination && typeof productPagination.limit === 'number' && productPagination.limit > 0) ? productPagination.limit : 9;
  const currentPage = (productPagination && typeof productPagination.page === 'number') ? productPagination.page : 1;
  const totalPages = Math.ceil(totalItems / paginationLimit);
  const safePages = isFinite(totalPages) && totalPages > 0 ? totalPages : 1;

  // Derive the selected product from the products state
  const selectedProduct = products.find(p => p.id === selectedProductId);

  // If a product has been selected, display the Product Detail Page instead of the list grid
  if (selectedProductId && selectedProduct) {
    return (
      <ProductDetailPage
        product={selectedProduct}
        onBack={() => setSelectedProductId(null)}
        handleEditProductClick={handleEditProductClick}
        handleDeleteProduct={handleDeleteProduct}
        stockColors={stockColors}
        handleCreateStockColor={handleCreateStockColor}
        handleToggleStockColorStatus={handleToggleStockColorStatus}
        handleDeleteStockColor={handleDeleteStockColor}
        handleSyncKnowledge={handleSyncKnowledge}
        fetchStockColors={fetchStockColors}
      />
    );
  }

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
                onOpenDetail={setSelectedProductId}
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
