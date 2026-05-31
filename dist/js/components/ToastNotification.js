window.ToastNotification = ({ toast, setToast }) => {
  if (!toast.show) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-toast-in flex items-center space-x-3 px-4 py-3.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-150 dark:border-darkbg-border shadow-2xl backdrop-blur-md max-w-sm">
      <div className={`p-2 rounded-xl ${toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : toast.type === 'error' ? 'bg-rose-500/10 text-rose-500' : 'bg-brand-500/10 text-brand-400'}`}>
        {toast.type === 'success' ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        ) : toast.type === 'error' ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        )}
      </div>
      <div className="flex-1 pr-2">
        <p className="text-xs font-extrabold leading-snug">{toast.message}</p>
      </div>
      <button type="button" onClick={() => setToast(prev => ({ ...prev, show: false }))} className="text-gray-400 hover:text-white transition">✕</button>
    </div>
  );
};
