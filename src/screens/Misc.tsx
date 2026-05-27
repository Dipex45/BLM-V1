import { motion } from 'framer-motion';

export function Reports() {
  return (
    <div className="p-8 md:p-12 flex flex-col gap-10 max-w-5xl mx-auto bg-background min-h-screen">
      <header className="border-b border-outline pb-8">
        <h1 className="text-4xl font-bold leading-none">Activity reports.</h1>
        <p className="text-on-surface-variant text-sm mt-3 font-medium">View and download your monthly transport summaries and logs.</p>
      </header>

      <div className="space-y-6">
        {[
          { title: 'Weekly Transport Audit', date: 'Aug 07, 2026', type: 'PDF', icon: 'description' },
          { title: 'Fleet Maintenance Log', date: 'Aug 05, 2026', type: 'XLS', icon: 'settings' },
          { title: 'Delivery Summary Report', date: 'Aug 02, 2026', type: 'PDF', icon: 'analytics' },
        ].map((report, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-8 rounded-lg border border-outline flex items-center justify-between hover:bg-surface-container transition-all cursor-pointer group shadow-sm"
          >
             <div className="flex items-center gap-6">
                <div className="w-14 h-14 bg-primary/10 text-primary rounded-md flex items-center justify-center">
                   <span className="material-symbols-outlined text-2xl">{report.icon}</span>
                </div>
                <div>
                   <p className="font-bold text-lg">{report.title}</p>
                   <p className="text-xs text-on-surface-variant mt-1 font-medium">{report.date}</p>
                </div>
             </div>
             <div className="flex flex-col items-end gap-2 text-right">
                <div className="text-xs font-bold text-primary border border-primary/20 px-4 py-1 rounded-md">
                   {report.type}
                </div>
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">download</span>
             </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
