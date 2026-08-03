const fs = require('fs');

const filePath = '/home/devendra/proj/wpcode/client/src/components/AdDetailPanel.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const newSummaryGrid = `          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: 'Impressions',
                value: metrics.impressions,
                title: 'Total number of times your ad was seen on a screen.',
                icon: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
              },
              {
                label: 'Reach',
                value: metrics.reach,
                title: 'Number of unique people who saw your ad at least once.',
                icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
              },
              {
                label: 'Frequency',
                value: metrics.frequency !== '-' ? parseFloat(metrics.frequency).toFixed(2) : '-',
                title: 'Average number of times each person saw your ad.',
                icon: <><polyline points="17 1 21 5 17 9" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 11V9a4 4 0 0 1 4-4h14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><polyline points="7 23 3 19 7 15" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 13v2a4 4 0 0 1-4 4H3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
              },
              {
                label: 'Clicks',
                value: metrics.clicks,
                title: 'Total number of clicks on your ad (including anywhere on the ad card).',
                icon: <><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M13 13l6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
              },
              {
                label: 'Unique Clicks',
                value: metrics.uniqueClicks,
                title: 'Number of unique people who clicked your ad.',
                icon: <><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
              },
              {
                label: 'Link Clicks',
                value: metrics.inlineLinkClicks,
                title: 'Clicks specifically on the WhatsApp button or link.',
                icon: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
              },
              {
                label: 'CTR (%)',
                value: metrics.ctr !== '-' ? parseFloat(metrics.ctr).toFixed(2) : '-',
                title: 'Click-Through Rate: Percentage of times people saw your ad and clicked it.',
                icon: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><polyline points="17 6 23 6 23 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
              }
            ].map((item, idx) => (
              <div key={idx} className="bg-white border border-[rgba(var(--color-brand-rgb),0.3)] rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-[var(--color-brand)] transition-all relative overflow-hidden">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-brand)] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <svg viewBox="0 0 24 24" className="w-5 h-5">
                      {item.icon}
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-black text-slate-800 leading-none mb-1 truncate">{item.value}</h3>
                    <p className="text-[9px] uppercase font-bold text-[var(--color-brand)] tracking-wider truncate">{item.label}</p>
                  </div>
                </div>
                <div className="absolute top-3 right-3 cursor-help" title={item.title}>
                  <span className="text-[8px] font-bold text-[var(--color-brand)] bg-[rgba(var(--color-brand-rgb),0.1)] px-1.5 py-0.5 rounded-full">ℹ️</span>
                </div>
              </div>
            ))}
          </div>`;

const newMetricsGrid = `        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: 'Total Spend',
              value: '₹' + (metrics.spend ? metrics.spend.toFixed(2) : '0.00'),
              title: 'Total amount of money spent on this item so far.',
              icon: <><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><line x1="2" y1="10" x2="22" y2="10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
            },
            {
              label: 'CPC',
              value: '₹' + (metrics.clicks > 0 ? (metrics.spend / metrics.clicks).toFixed(2) : '0.00'),
              title: 'Cost Per Click: Average cost you paid for each click.',
              icon: <><path d="M12 2v20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
            },
            {
              label: 'CPM (1k Imp)',
              value: '₹' + (metrics.impressions > 0 ? ((metrics.spend / metrics.impressions) * 1000).toFixed(2) : '0.00'),
              title: 'Cost per Mille: Average cost you paid for 1,000 impressions.',
              icon: <><path d="M12 2v20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
            },
            {
              label: 'CTR',
              value: metrics.ctr !== '-' ? parseFloat(metrics.ctr).toFixed(2) + '%' : '0.00%',
              title: 'Percentage of times people saw your ad and clicked on it.',
              icon: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><polyline points="17 6 23 6 23 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
            }
          ].map((item, idx) => (
            <div key={idx} className="bg-white border border-[rgba(var(--color-brand-rgb),0.3)] rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-[var(--color-brand)] transition-all relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-brand)] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <svg viewBox="0 0 24 24" className="w-5 h-5">
                    {item.icon}
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-black text-slate-800 leading-none mb-1 truncate">{item.value}</h3>
                  <p className="text-[9px] uppercase font-bold text-[var(--color-brand)] tracking-wider truncate">{item.label}</p>
                </div>
              </div>
              <div className="absolute top-3 right-3 cursor-help" title={item.title}>
                <span className="text-[8px] font-bold text-[var(--color-brand)] bg-[rgba(var(--color-brand-rgb),0.1)] px-1.5 py-0.5 rounded-full">ℹ️</span>
              </div>
            </div>
          ))}
        </div>`;

const newInsightsGrid = `          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: 'Quality Ranking',
                value: metrics.qualityRanking.replace(/_/g, ' '),
                icon: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
              },
              {
                label: 'Engagement Ranking',
                value: metrics.engagementRanking.replace(/_/g, ' '),
                icon: <><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
              }
            ].map((item, idx) => (
              <div key={idx} className="bg-white border border-[rgba(var(--color-brand-rgb),0.3)] rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-[var(--color-brand)] transition-all relative overflow-hidden">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-brand)] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <svg viewBox="0 0 24 24" className="w-5 h-5">
                      {item.icon}
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-black text-slate-800 leading-tight mb-1 truncate capitalize">{item.value}</h3>
                    <p className="text-[9px] uppercase font-bold text-[var(--color-brand)] tracking-wider truncate">{item.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>`;

// Replace Summary
const startSummary = '<div className="grid grid-cols-2 md:grid-cols-4 gap-4">';
const endSummary = '</div>\n\n          {/* Time Series Graph */}';
if (content.includes(startSummary) && content.includes(endSummary)) {
  const parts = content.split(endSummary);
  const prefix = parts[0].substring(0, parts[0].indexOf(startSummary));
  content = prefix + newSummaryGrid + '\n\n          {/* Time Series Graph */}' + parts[1];
}

// Replace Metrics
const startMetrics = '{activeTab === \\'metrics\\' && (\n        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">';
const endMetrics = '</div>\n      )}\n\n      {activeTab === \\'conversions\\'';
if (content.includes(startMetrics) && content.includes(endMetrics)) {
  const parts = content.split(endMetrics);
  const prefix = parts[0].substring(0, parts[0].indexOf(startMetrics));
  content = prefix + "{activeTab === 'metrics' && (\n" + newMetricsGrid + '\n      )}\n\n      {activeTab === \'conversions\'' + parts[1];
}

// Replace Insights
const startInsights = '{activeTab === \\'insights\\' && (\n        <div className="space-y-6">\n          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">';
const endInsights = '</div>\n          \n          {/* Demographic Breakdown placeholder */}';
if (content.includes(startInsights) && content.includes(endInsights)) {
  const parts = content.split(endInsights);
  const prefix = parts[0].substring(0, parts[0].indexOf(startInsights));
  content = prefix + "{activeTab === 'insights' && (\n        <div className=\"space-y-6\">\n" + newInsightsGrid + '\n          \n          {/* Demographic Breakdown placeholder */}' + parts[1];
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Update successful');
