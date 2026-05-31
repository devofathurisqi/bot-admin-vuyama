window.MediaTab = ({
  activeTab,
  media,
  galleryInputRef,
  handleMediaUpload,
  handleDeleteMedia
}) => {
  if (activeTab !== 'media') return null;

  return (
    <div className="space-y-6 text-xs text-slate-300">
      <div className="flex items-center justify-between border-b border-darkbg-border pb-5">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold font-sans text-gray-800 dark:text-white">Media Management</h2>
          <p className="text-xs text-gray-500 font-medium">Upload images, label templates, and catalog PDF. Bot can fetch these files in chat replies.</p>
        </div>

        <button
          onClick={() => galleryInputRef.current.click()}
          className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm shadow-lg shadow-brand-500/15 flex items-center space-x-2 transition"
        >
          <Icons.Upload />
          <span>Upload Media File</span>
        </button>
        <input
          type="file"
          ref={galleryInputRef}
          onChange={handleMediaUpload}
          className="hidden"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-6 text-gray-800 dark:text-gray-250">
        {media.map(item => (
          <div key={item.id} className="rounded-2xl border border-darkbg-border bg-white dark:bg-darkbg-card overflow-hidden shadow-sm flex flex-col justify-between group">
            
            {/* File Preview */}
            <div className="h-32 bg-gray-800 flex items-center justify-center overflow-hidden border-b border-darkbg-border relative">
              {item.mime_type.startsWith('image') ? (
                <img src={item.filepath} alt={item.original_name} className="w-full h-full object-cover" />
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
        {media.length === 0 && (
          <p className="col-span-full p-12 text-center text-gray-500">Belum ada file terunggah.</p>
        )}
      </div>
    </div>
  );
};
