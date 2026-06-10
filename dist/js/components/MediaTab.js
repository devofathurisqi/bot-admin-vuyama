// Skeleton Loader for Media Cards (Defined outside parent component to prevent remount lag)
const SkeletonMediaGrid = () => {
  return (
    <React.Fragment>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="rounded-2xl border border-darkbg-border bg-white dark:bg-darkbg-card overflow-hidden shadow-sm flex flex-col justify-between h-[210px] animate-pulse">
          <div className="h-32 bg-gray-200 dark:bg-gray-800" />
          <div className="p-3.5 space-y-2 flex-1">
            <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-2 w-1/4 bg-gray-200 dark:bg-gray-800 rounded" />
          </div>
          <div className="p-2 border-t border-darkbg-border bg-gray-50 dark:bg-gray-800/40 flex justify-between">
            <div className="h-5 w-16 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-5 w-6 bg-gray-200 dark:bg-gray-800 rounded" />
          </div>
        </div>
      ))}
    </React.Fragment>
  );
};

window.MediaTab = ({
  activeTab,
  media = [],
  galleryInputRef,
  handleMediaUpload,
  handleDeleteMedia,
  mediaSearch,
  setMediaSearch,
  mediaPage,
  setMediaPage,
  mediaPagination,
  mediaLoading
}) => {
  // Local filter for PDF/Documents vs Images
  const [fileTypeFilter, setFileTypeFilter] = React.useState('all'); // all, pdf, image

  if (activeTab !== 'media') return null;

  // Filter media locally to avoid lag and provide instant response
  const filteredMedia = React.useMemo(() => {
    return media.filter(item => {
      const mime = item.mime_type || '';
      if (fileTypeFilter === 'pdf') {
        return mime.toLowerCase().includes('pdf') || mime.toLowerCase().includes('document');
      }
      if (fileTypeFilter === 'image') {
        return mime.toLowerCase().startsWith('image/');
      }
      return true;
    });
  }, [media, fileTypeFilter]);

  // Safe pagination calculations
  const totalItems = (mediaPagination && typeof mediaPagination.total === 'number') ? mediaPagination.total : 0;
  const paginationLimit = (mediaPagination && typeof mediaPagination.limit === 'number' && mediaPagination.limit > 0) ? mediaPagination.limit : 12;
  const currentPage = (mediaPagination && typeof mediaPagination.page === 'number') ? mediaPagination.page : 1;
  const totalPages = Math.ceil(totalItems / paginationLimit);
  const safePages = isFinite(totalPages) && totalPages > 0 ? totalPages : 1;

  return (
    <div className="space-y-6 text-xs text-slate-300">
      
      {/* Tab Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-darkbg-border pb-5 gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold font-sans text-gray-800 dark:text-white">Promo & Content Library</h2>
          <p className="text-xs text-gray-500 font-medium">
            Upload brochures, catalogs, promo banners, or custom PDFs. The AI bot will dynamically search and attach these files when chatting with customers.
          </p>
        </div>

        <button
          onClick={() => {
            galleryInputRef.current.tagToUpload = 'general';
            galleryInputRef.current.click();
          }}
          className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-500/15 flex items-center space-x-2 transition shrink-0 self-start md:self-auto"
        >
          <Icons.Upload className="w-4 h-4" />
          <span>Upload File</span>
        </button>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500"><Icons.Search className="w-4 h-4" /></span>
          <input
            type="text"
            value={mediaSearch}
            onChange={(e) => setMediaSearch(e.target.value)}
            placeholder="Search files by name..."
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-darkbg-card border border-gray-200 dark:border-darkbg-border font-medium text-xs focus:outline-none focus:border-brand-500 transition text-gray-800 dark:text-white"
          />
        </div>

        {/* File Type Filter Tabs */}
        <div className="p-1 rounded-xl bg-gray-100 dark:bg-darkbg-card border border-darkbg-border flex items-center space-x-1 shrink-0 w-fit">
          {[
            { id: 'all', label: 'All Files', icon: Icons.Folder },
            { id: 'pdf', label: 'PDFs & Docs', icon: Icons.Logs },
            { id: 'image', label: 'Images & Promos', icon: Icons.Media }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFileTypeFilter(tab.id)}
              className={`px-3.5 py-2 rounded-lg font-bold text-[10px] uppercase transition duration-200 flex items-center space-x-1.5 ${
                fileTypeFilter === tab.id
                  ? 'bg-white dark:bg-gray-800 text-brand-600 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-white'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* MEDIA GRID LIST */}
      <div className={`grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-6 text-gray-800 dark:text-gray-250 transition-opacity duration-200 ${mediaLoading ? 'opacity-50 pointer-events-none' : ''}`}>
        {mediaLoading && media.length === 0 ? (
          <SkeletonMediaGrid />
        ) : (
          <React.Fragment>
            {filteredMedia.map(item => {
              const isPdf = item.mime_type?.toLowerCase().includes('pdf') || item.original_name?.toLowerCase().endsWith('.pdf');
              return (
                <div key={item.id} className="rounded-2xl border border-darkbg-border bg-white dark:bg-darkbg-card overflow-hidden shadow-sm flex flex-col justify-between group h-[235px] hover:shadow-lg transition duration-200">
                  
                  {/* File Preview */}
                  <div className="h-32 bg-gray-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden border-b border-darkbg-border relative shrink-0">
                    {!isPdf && item.filepath ? (
                      <window.ImageWithSkeleton src={item.filepath} alt={item.original_name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-2 text-rose-500 dark:text-rose-400">
                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <span className="font-extrabold text-[9px] uppercase tracking-widest leading-none bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded">PDF DOCUMENT</span>
                      </div>
                    )}

                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[8px] font-extrabold bg-brand-600/90 text-white uppercase tracking-wide">
                      {item.tag || 'general'}
                    </span>
                  </div>

                  {/* File Meta */}
                  <div className="p-3.5 space-y-1 flex-1 min-w-0 flex flex-col justify-center">
                    <h4 className="font-bold text-xs truncate text-slate-800 dark:text-white" title={item.original_name}>{item.original_name}</h4>
                    <span className="text-[9px] text-gray-500 font-semibold block">{(item.size / 1024).toFixed(1)} KB</span>
                  </div>

                  {/* Copy URL & Delete */}
                  <div className="p-2 border-t border-darkbg-border bg-gray-50 dark:bg-gray-800/40 flex items-center justify-between shrink-0">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.origin + item.filepath);
                        alert('Link media berhasil dicopy!');
                      }}
                      className="px-2.5 py-1 rounded text-[9px] font-extrabold bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-300 hover:bg-brand-600 hover:text-white dark:hover:text-white transition"
                    >
                      Copy Link
                    </button>
                    <button
                      onClick={() => handleDeleteMedia(item.id)}
                      className="p-1.5 rounded text-rose-500 hover:bg-rose-500/10 transition"
                      title="Hapus Media"
                    >
                      <Icons.Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredMedia.length === 0 && (
              <div className="col-span-full p-12 text-center border border-dashed border-darkbg-border rounded-2xl">
                <p className="text-gray-500 font-medium">No files found matching this criteria.</p>
              </div>
            )}
          </React.Fragment>
        )}
      </div>

      {/* PAGINATION CONTROLS */}
      {totalItems > paginationLimit && (
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-darkbg-border pt-6 mt-8 gap-4 select-none">
          <span className="text-xs text-gray-500 font-medium">
            Showing <strong className="text-gray-800 dark:text-white font-extrabold">{((currentPage - 1) * paginationLimit) + 1}</strong> to <strong className="text-gray-800 dark:text-white font-extrabold">{Math.min(currentPage * paginationLimit, totalItems)}</strong> of <strong className="text-gray-800 dark:text-white font-extrabold">{totalItems}</strong> files
          </span>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setMediaPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage <= 1}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-darkbg-card border border-gray-200 dark:border-darkbg-border font-bold text-xs hover:bg-gray-50 dark:hover:bg-gray-850 disabled:opacity-40 disabled:cursor-not-allowed transition text-gray-700 dark:text-gray-300"
            >
              Previous
            </button>

            {Array.from({ length: safePages }).map((_, idx) => {
              const pNum = idx + 1;
              return (
                <button
                  key={pNum}
                  type="button"
                  onClick={() => setMediaPage(pNum)}
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

            <button
              type="button"
              onClick={() => setMediaPage(prev => Math.min(prev + 1, safePages))}
              disabled={currentPage >= safePages}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-darkbg-card border border-gray-200 dark:border-darkbg-border font-bold text-xs hover:bg-gray-50 dark:hover:bg-gray-850 disabled:opacity-40 disabled:cursor-not-allowed transition text-gray-700 dark:text-gray-300"
            >
              Next
            </button>
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
