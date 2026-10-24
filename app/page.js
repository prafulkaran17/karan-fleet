'use client';
import { useEffect, useRef } from 'react';

export default function Page() {
  const ref = useRef(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const { jsPDF } = await import('jspdf');
      await import('jspdf-autotable');           // registers doc.autoTable
      const drive = await import('../lib/drive-sync');
      const { initFleet } = await import('../lib/fleet-core');
      initFleet({ root: ref.current, jsPDF, drive });
      if ('serviceWorker' in navigator) {
        try { await navigator.serviceWorker.register('/sw.js'); } catch (e) {}
      }
    })();
  }, []);
  return <div ref={ref} style={{ minHeight: '100%' }} />;
}
