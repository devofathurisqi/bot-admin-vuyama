window.MediaTab = ({
  activeTab,
  media,
  galleryInputRef,
  handleMediaUpload,
  handleDeleteMedia,
  stockColors = [],
  handleCreateStockColor,
  handleToggleStockColorStatus,
  handleDeleteStockColor,
  handleSyncKnowledge
}) => {
  if (activeTab !== 'media') return null;

  const [mediaSubTab, setMediaSubTab] = React.useState('color_stock'); // 'color_stock', 'gallery', or 'colors'
  const [newColorName, setNewColorName] = React.useState('');
  const [newColorCategory, setNewColorCategory] = React.useState('Mukena');
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const colorFileInputRef = React.useRef(null);
  
  // Local filter for stock colors
  const [colorFilter, setColorFilter] = React.useState('Semua');

  const handleSubmitColor = async (e) => {
    e.preventDefault();
    if (!newColorName.trim()) {
      alert('Nama warna wajib diisi!');
      return;
    }
    const file = colorFileInputRef.current?.files[0];
    if (!file) {
      alert('Gambar swatch warna wajib diunggah!');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('color_name', newColorName.trim());
    formData.append('category', newColorCategory);
    formData.append('is_ready', 'true');

    await handleCreateStockColor(formData);

    // Reset Form
    setNewColorName('');
    setIsFormOpen(false);
    if (colorFileInputRef.current) colorFileInputRef.current.value = '';
  };

  const filteredColors = stockColors.filter(c => {
    if (colorFilter === 'Semua') return true;
    return c.category?.toLowerCase() === colorFilter.toLowerCase();
  });

  return (
    <div className="space-y-6 text-xs text-slate-300">
      
      {/* Tab Header & Switcher */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-darkbg-border pb-5 gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold font-sans text-gray-800 dark:text-white">Media & Stock Board</h2>
          <p className="text-xs text-gray-500 font-medium">
            Kelola berkas katalog, gambar, dokumen, serta papan status stok warna kain harian Anda.
          </p>
        </div>

        {/* Sub-tab Switcher Buttons */}
        <div className="p-1 rounded-xl bg-gray-100 dark:bg-darkbg-card border border-darkbg-border flex items-center space-x-1 shrink-0 w-fit self-start md:self-auto">
          <button
            onClick={() => setMediaSubTab('color_stock')}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition duration-200 flex items-center space-x-2 ${
              mediaSubTab === 'color_stock'
                ? 'bg-white dark:bg-gray-800 text-brand-500 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-white'
            }`}
          >
            <Icons.Palette />
            <span>Color Stock</span>
          </button>
          <button
            onClick={() => setMediaSubTab('gallery')}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition duration-200 flex items-center space-x-2 ${
              mediaSubTab === 'gallery'
                ? 'bg-white dark:bg-gray-800 text-brand-500 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-white'
            }`}
          >
            <Icons.Folder />
            <span>Others</span>
          </button>
          <button
            onClick={() => setMediaSubTab('colors')}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition duration-200 flex items-center space-x-2 ${
              mediaSubTab === 'colors'
                ? 'bg-white dark:bg-gray-800 text-brand-500 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-white'
            }`}
          >
            <Icons.Check />
            <span>Stock Color Board</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1A. COLOR STOCK FILES SUB-TAB */}
      {/* ============================================================== */}
      {mediaSubTab === 'color_stock' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-gray-750 dark:text-gray-200 flex items-center space-x-2">
              <span className="w-1.5 h-3 rounded bg-indigo-500"></span>
              <span>Color Stock Compilation Folder (`data/media/color_stock`)</span>
            </h3>
            <button
              onClick={() => {
                galleryInputRef.current.tagToUpload = 'color_stock';
                galleryInputRef.current.click();
              }}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/15 flex items-center space-x-2 transition"
            >
              <Icons.Upload />
              <span>Upload Color Stock File</span>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-6 text-gray-800 dark:text-gray-250">
            {media.filter(item => item.tag === 'color_stock').map(item => (
              <div key={item.id} className="rounded-2xl border border-darkbg-border bg-white dark:bg-darkbg-card overflow-hidden shadow-sm flex flex-col justify-between group">
                
                {/* File Preview */}
                <div className="h-32 bg-gray-800 flex items-center justify-center overflow-hidden border-b border-darkbg-border relative">
                  <window.ImageWithSkeleton src={item.filepath} alt={item.original_name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[8px] font-extrabold bg-indigo-600/90 text-white uppercase tracking-wide">
                    Color Stock
                  </span>
                </div>

                {/* File Meta */}
                <div className="p-3.5 space-y-1">
                  <h4 className="font-bold text-xs truncate text-gray-850 dark:text-white" title={item.original_name}>{item.original_name}</h4>
                  <span className="text-[9px] text-gray-500 font-semibold">{(item.size / 1024).toFixed(1)} KB</span>
                </div>

                {/* Copy URL & Delete */}
                <div className="p-2 border-t border-darkbg-border bg-gray-50 dark:bg-gray-800/40 flex items-center justify-between shrink-0">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.origin + item.filepath);
                      alert('Link media stock warna berhasil dicopy!');
                    }}
                    className="px-2.5 py-1 rounded text-[9px] font-extrabold bg-gray-850 dark:bg-gray-800 text-gray-400 hover:text-white transition"
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={() => handleDeleteMedia(item.id)}
                    className="p-1.5 rounded text-rose-500 hover:bg-rose-500/10 transition"
                  >
                    <Icons.Trash />
                  </button>
                </div>
              </div>
            ))}
            {media.filter(item => item.tag === 'color_stock').length === 0 && (
              <p className="col-span-full p-12 text-center text-gray-500">Belum ada file stock warna terunggah di folder `color_stock`.</p>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1B. OTHERS FILES GALLERY SUB-TAB */}
      {/* ============================================================== */}
      {mediaSubTab === 'gallery' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-gray-750 dark:text-gray-200 flex items-center space-x-2">
              <span className="w-1.5 h-3 rounded bg-brand-500"></span>
              <span>Others Files Gallery (`data/media/others`)</span>
            </h3>
            <button
              onClick={() => {
                galleryInputRef.current.tagToUpload = 'general';
                galleryInputRef.current.click();
              }}
              className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm shadow-lg shadow-brand-500/15 flex items-center space-x-2 transition"
            >
              <Icons.Upload />
              <span>Upload Media File</span>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-6 text-gray-800 dark:text-gray-250">
            {media.filter(item => item.tag !== 'color_stock').map(item => (
              <div key={item.id} className="rounded-2xl border border-darkbg-border bg-white dark:bg-darkbg-card overflow-hidden shadow-sm flex flex-col justify-between group">
                
                {/* File Preview */}
                <div className="h-32 bg-gray-800 flex items-center justify-center overflow-hidden border-b border-darkbg-border relative">
                  {item.mime_type.startsWith('image') ? (
                    <window.ImageWithSkeleton src={item.filepath} alt={item.original_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-brand-400 font-extrabold uppercase text-[10px] tracking-widest leading-none">PDF / DOC</div>
                  )}

                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[8px] font-extrabold bg-brand-600/90 text-white uppercase tracking-wide">
                    {item.tag}
                  </span>
                </div>

                {/* File Meta */}
                <div className="p-3.5 space-y-2">
                  <h4 className="font-bold text-xs truncate text-gray-850 dark:text-white" title={item.original_name}>{item.original_name}</h4>
                  <span className="text-[9px] text-gray-500 font-semibold">{(item.size / 1024).toFixed(1)} KB</span>
                </div>

                {/* Copy URL & Delete */}
                <div className="p-2 border-t border-darkbg-border bg-gray-50 dark:bg-gray-800/40 flex items-center justify-between shrink-0">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.origin + item.filepath);
                      alert('Link media berhasil dicopy!');
                    }}
                    className="px-2.5 py-1 rounded text-[9px] font-extrabold bg-gray-850 dark:bg-gray-800 text-gray-400 hover:text-white transition"
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={() => handleDeleteMedia(item.id)}
                    className="p-1.5 rounded text-rose-500 hover:bg-rose-500/10 transition"
                  >
                    <Icons.Trash />
                  </button>
                </div>
              </div>
            ))}
            {media.filter(item => item.tag !== 'color_stock').length === 0 && (
              <p className="col-span-full p-12 text-center text-gray-500">Belum ada file terunggah.</p>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. STOCK COLOR BOARD SUB-TAB */}
      {/* ============================================================== */}
      {mediaSubTab === 'colors' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-sm font-extrabold text-gray-750 dark:text-gray-200 flex items-center space-x-2">
              <span className="w-1.5 h-3 rounded bg-brand-500"></span>
              <span>Stock Color Swatch Board</span>
            </h3>
            
            <div className="flex items-center space-x-2 self-end sm:self-auto">
              <button
                onClick={handleSyncKnowledge}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/15 flex items-center space-x-2 transition"
                title="Sinkronisasi Informasi Stok Warna ke Backup Wawasan AI"
              >
                <Icons.Refresh className="w-4 h-4" />
                <span>Sync Knowledge</span>
              </button>
              
              <button
                onClick={() => setIsFormOpen(!isFormOpen)}
                className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-500/15 flex items-center space-x-2 transition"
              >
                <span>{isFormOpen ? 'Tutup Form' : 'Tambah Swatch Warna'}</span>
                <Icons.Plus className={`transform transition duration-200 ${isFormOpen ? 'rotate-45' : ''}`} />
              </button>
            </div>
          </div>

          {/* Form to Add Swatch Color */}
          {isFormOpen && (
            <form onSubmit={handleSubmitColor} className="p-5 rounded-2xl border border-darkbg-border bg-white dark:bg-darkbg-card shadow-sm space-y-4 max-w-xl animate-fadeIn text-gray-800 dark:text-gray-250">
              <h4 className="font-extrabold text-xs text-brand-600 dark:text-brand-400 uppercase tracking-widest leading-none">Tambah Swatch Warna Baru</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nama Warna</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Milo, Soft Pink, Navy"
                    value={newColorName}
                    onChange={(e) => setNewColorName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl border-gray-300 dark:border-gray-700 bg-transparent dark:text-white font-medium focus:outline-none focus:border-brand-500 transition text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Kategori Produk</label>
                  <select
                    value={newColorCategory}
                    onChange={(e) => setNewColorCategory(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl border-gray-300 dark:border-gray-700 bg-white dark:bg-darkbg-card dark:text-white font-medium focus:outline-none focus:border-brand-500 transition text-xs"
                  >
                    <option value="Mukena">Mukena</option>
                    <option value="Hijab">Hijab</option>
                    <option value="Label">Label</option>
                    <option value="General">Lainnya / Umum</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Unggah Gambar Swatch Kain</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="file"
                    required
                    ref={colorFileInputRef}
                    accept="image/*"
                    className="text-xs text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-gray-150 file:dark:bg-gray-800 file:text-gray-700 file:dark:text-white hover:file:bg-brand-500/10 cursor-pointer w-full"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs tracking-wider uppercase transition shadow-md shadow-brand-500/10"
              >
                Simpan Swatch Warna
              </button>
            </form>
          )}

          {/* Category Filter Swapper */}
          <div className="flex flex-wrap items-center gap-2">
            {['Semua', 'Mukena', 'Hijab', 'Label', 'General'].map(cat => (
              <button
                key={cat}
                onClick={() => setColorFilter(cat)}
                className={`px-3 py-1.5 rounded-full font-bold text-[10px] tracking-wide uppercase transition duration-200 ${
                  colorFilter === cat
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-white dark:bg-darkbg-card border border-darkbg-border text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {cat === 'General' ? 'Lainnya' : cat}
              </button>
            ))}
          </div>

          {/* Swatches Color Board Grid Card Layout */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-6 text-gray-850 dark:text-gray-250">
            {filteredColors.map(color => (
              <div
                key={color.id}
                className="group relative rounded-2xl border border-darkbg-border bg-white dark:bg-darkbg-card overflow-hidden shadow-sm flex flex-col justify-between transition duration-300 hover:shadow-lg"
              >
                
                {/* Swatch fabric photo box container */}
                <div className="h-44 bg-slate-900 flex items-center justify-center overflow-hidden border-b border-darkbg-border relative select-none">
                  <window.ImageWithSkeleton
                    src={color.image_path}
                    alt={color.color_name}
                    className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                  />

                  {/* Category Pill Tag */}
                  <span className="absolute top-3 left-3 px-2 py-0.5 rounded text-[8px] font-extrabold bg-brand-600/90 text-white uppercase tracking-wide z-20">
                    {color.category}
                  </span>

                  {/* ❌ OUT OF STOCK STRIKE/CROSS OVERLAY */}
                  {!color.is_ready && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-[0.5px] flex flex-col items-center justify-center text-rose-500 space-y-2 select-none z-10 animate-fadeIn">
                      {/* Big Cross Icon */}
                      <div className="w-12 h-12 rounded-full border-[3px] border-rose-500 flex items-center justify-center text-3xl font-black leading-none drop-shadow-md select-none bg-rose-950/20">
                        ✕
                      </div>
                      <span className="text-[9px] font-black tracking-widest uppercase bg-rose-500/10 border border-rose-500/30 px-3 py-1 rounded-full text-rose-400 drop-shadow">
                        STOCK KOSONG
                      </span>
                    </div>
                  )}
                </div>

                {/* Color swatch metadata details */}
                <div className="p-3.5 flex items-center justify-between border-b border-darkbg-border bg-gray-50 dark:bg-transparent">
                  <div className="space-y-1 truncate">
                    <h4 className="font-extrabold text-xs text-gray-900 dark:text-white truncate" title={color.color_name}>
                      {color.color_name}
                    </h4>
                    <span className={`text-[8px] font-black uppercase tracking-wider ${color.is_ready ? 'text-green-500' : 'text-rose-500'}`}>
                      {color.is_ready ? '● READY STOCK' : '● STOK KOSONG'}
                    </span>
                  </div>
                  
                  {/* Quick Copy Link Button */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.origin + color.image_path);
                      alert(`Link gambar warna ${color.color_name} berhasil dicopy!`);
                    }}
                    className="p-1.5 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-300 hover:bg-brand-500 hover:text-white dark:hover:bg-brand-600 transition"
                    title="Copy Link Swatch Gambar"
                  >
                    <Icons.Copy className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Swatch Controls: Toggle Ready or Delete Color Swatch Card */}
                <div className="p-2 bg-gray-100/40 dark:bg-gray-800/20 flex items-center justify-between shrink-0">
                  <button
                    onClick={() => handleToggleStockColorStatus(color.id, color.is_ready)}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-extrabold uppercase transition duration-200 flex-1 mr-2 text-center ${
                      color.is_ready
                        ? 'bg-rose-500 hover:bg-rose-600 text-white'
                        : 'bg-green-600 hover:bg-green-500 text-white'
                    }`}
                  >
                    {color.is_ready ? '❌ Coret (Kosong)' : '✓ Aktifkan (Ready)'}
                  </button>
                  
                  <button
                    onClick={() => handleDeleteStockColor(color.id)}
                    className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition border border-transparent hover:border-rose-500/20"
                    title="Hapus Warna"
                  >
                    <Icons.Trash className="w-4 h-4" />
                  </button>
                </div>

              </div>
            ))}
            {filteredColors.length === 0 && (
              <div className="col-span-full p-12 text-center border border-dashed border-darkbg-border rounded-2xl">
                <p className="text-gray-500 font-medium">Belum ada swatch warna kain terdaftar untuk kategori ini.</p>
              </div>
            )}
          </div>
        </div>
      )}
      <input
        type="file"
        ref={galleryInputRef}
        onChange={handleMediaUpload}
        className="hidden"
      />
    </div>
  );
};
