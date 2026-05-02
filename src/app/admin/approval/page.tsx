"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle2, 
  XSquare, 
  Clock, 
  MapPin, 
  Bed, 
  Square, 
  Car, 
  User, 
  Calendar, 
  Sparkles, 
  ArrowLeft, 
  RefreshCw,
  Info
} from "lucide-react";

interface Pending {
  id: string;
  title?: string;
  address?: string;
  price?: number | string;
  size?: string;
  sizeUnit?: string;
  area?: string;
  bedrooms?: string;
  rooms?: string;
  suites?: string;
  parkingSpaces?: string | number;
  images?: string[];
  aiDescription?: string;
  imagePath?: string;
  receivedAt?: string;
  status?: string;
  brokerName?: string;
  brokerCreci?: string;
  brokerTelegramId?: string;
  type?: string;
  offerType?: string;
}

export default function ApprovalPage() {
  const [pending, setPending] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/partner/properties/pending")
      .then((r) => r.json())
      .then((d) => { 
        setPending(d.pending || []); 
        setLoading(false); 
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000); // auto-refresh a cada 30s
    return () => clearInterval(iv);
  }, [load]);

  const showToast = (msg: string, type: "ok" | "err") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const act = async (id: string, action: "approve" | "reject") => {
    setActing(id);
    try {
      const res = await fetch("/api/partner/properties/pending", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, "ok");
        load();
      } else showToast(data.error || "Erro ao processar", "err");
    } catch { 
      showToast("Erro de rede", "err"); 
    }
    setActing(null);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-orange-500 selection:text-white font-sans">
      
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-8 right-8 z-[100] px-6 py-4 rounded-2xl flex items-center gap-3 backdrop-blur-xl border ${
              toast.type === "ok" 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            }`}
          >
            {toast.type === "ok" ? <CheckCircle2 size={20} /> : <XSquare size={20} />}
            <span className="font-bold text-sm">{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-50 bg-black/40 backdrop-blur-2xl border-b border-white/5 px-6 md:px-12 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/40">
              <span className="font-black text-white text-xl">⚖️</span>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight leading-none mb-1">Centro de Triagem</h1>
              <p className="text-[10px] md:text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                iAmobil <span className="w-1 h-1 bg-orange-500 rounded-full" /> Curadoria Partner Premium
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <button 
               onClick={load}
               className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all group active:scale-90"
             >
               <RefreshCw size={18} className={`text-gray-400 group-hover:text-white ${loading ? 'animate-spin' : ''}`} />
             </button>
             <a 
               href="/admin/partners" 
               className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white hidden sm:block"
             >
               Gestão de Parceiros
             </a>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12 md:py-20">
        
        {/* Count Dashboard */}
        <div className="flex items-center gap-6 mb-16">
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter">Fila de Aprovação</h2>
          <div className="bg-orange-500/10 border border-orange-500/20 text-orange-500 rounded-2xl px-6 py-2.5 font-black text-xl md:text-3xl shadow-2xl shadow-orange-500/10">
            {pending.length}
          </div>
        </div>

        {loading && pending.length === 0 ? (
          <div className="py-32 flex flex-col items-center gap-6">
             <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
             <p className="text-gray-500 font-black uppercase tracking-widest text-xs">Sincronizando com Hub...</p>
          </div>
        ) : pending.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-32 flex flex-col items-center gap-8 bg-white/5 rounded-[4rem] border border-white/5 border-dashed"
          >
             <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center text-5xl">✨</div>
             <div className="text-center">
                <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Tudo em conformidade!</h3>
                <p className="text-gray-500 font-medium">Nenhum imóvel pendente de revisão no momento.</p>
             </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 gap-12">
            <AnimatePresence>
              {pending.map((p, idx) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 100 }}
                  transition={{ delay: idx * 0.1 }}
                  className="group relative bg-white/5 rounded-[3rem] border border-white/5 hover:border-white/10 transition-all overflow-hidden shadow-2xl"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12">
                    
                    {/* Media Section: Improved Gallery */}
                    <div className="lg:col-span-4 relative h-[400px] lg:h-auto bg-black/20 flex flex-col">
                      <div className="flex-1 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide">
                        {(p.images && p.images.length > 0) ? (
                          p.images.map((img, i) => (
                            <div key={i} className="min-w-full h-full snap-center relative">
                              <img 
                                src={img} 
                                alt="" 
                                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                              />
                            </div>
                          ))
                        ) : (
                          <div className="min-w-full h-full flex items-center justify-center bg-gray-900">
                             <img 
                                src={p.imagePath || "/properties/mansion.png"} 
                                alt="" 
                                className="w-full h-full object-cover"
                              />
                          </div>
                        )}
                      </div>
                      
                      {/* Image count indicator toggle */}
                      {p.images && p.images.length > 1 && (
                        <div className="absolute bottom-6 right-8 px-3 py-1 bg-black/60 backdrop-blur rounded-full text-[10px] font-black uppercase tracking-widest text-white/80 border border-white/5">
                           {p.images.length} FOTOS
                        </div>
                      )}

                      <div className="absolute top-8 left-8">
                         <div className="px-5 py-2 bg-orange-500 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-2xl">
                           {p.type || "IMÓVEL"}
                         </div>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="lg:col-span-8 p-8 md:p-14 space-y-10">
                      
                      {/* Header Info */}
                      <div className="space-y-6">
                        <div className="flex flex-wrap items-center gap-4 text-gray-500 text-[10px] md:text-xs font-black uppercase tracking-[0.2em]">
                           <span className="flex items-center gap-2"><Clock size={14} className="text-orange-500" /> {new Date(p.receivedAt || "").toLocaleString("pt-BR")}</span>
                           <span className="w-1 h-1 bg-white/10 rounded-full" />
                           <span className="flex items-center gap-2"><User size={14} className="text-orange-500" /> {p.brokerName} ({p.brokerCreci || "S/ CRECI"})</span>
                        </div>
                        <h3 className="text-3xl md:text-5xl font-black tracking-tighter leading-[0.9]">{p.title || "Imóvel sem Título"}</h3>
                        <p className="text-gray-400 text-lg md:text-xl font-medium flex items-center gap-3">
                           <MapPin size={24} className="text-orange-500 flex-shrink-0" /> {p.address || "Localização não informada"}
                        </p>
                      </div>

                      {/* Config Row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-white/5 p-8 rounded-[2.5rem] border border-white/5">
                         <div className="space-y-1">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Square size={12} /> Área</span>
                            <div className="text-xl font-black">{p.size || p.area || "—"} <span className="text-[10px] text-gray-500">{p.sizeUnit || 'm²'}</span></div>
                         </div>
                         <div className="space-y-1">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Bed size={12} /> Quartos</span>
                            <div className="text-xl font-black">{p.bedrooms || p.rooms || "—"} <span className="text-[10px] text-gray-600">({p.suites || 0}s)</span></div>
                         </div>
                         <div className="space-y-1">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Car size={12} /> Vagas</span>
                            <div className="text-xl font-black">{p.parkingSpaces || 0}</div>
                         </div>
                         <div className="space-y-1">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Preço</span>
                            <div className="text-xl font-black text-emerald-400 leading-none">R$ {Number(p.price || 0).toLocaleString("pt-BR")}</div>
                         </div>
                      </div>

                      {/* AI Description Highlight */}
                      {p.aiDescription && (
                        <div className="relative group/ai">
                           <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/20 to-purple-500/20 rounded-[2.5rem] blur opacity-50 transition duration-1000 group-hover/ai:opacity-100" />
                           <div className="relative bg-black/60 rounded-[2rem] border border-white/10 p-8 space-y-4">
                              <div className="flex items-center gap-2 text-orange-500 text-[10px] font-black uppercase tracking-[0.2em]">
                                 <Sparkles size={14} /> Mágica IA de Vendas
                              </div>
                              <p className="text-gray-300 leading-relaxed font-medium italic italic">
                                 "{p.aiDescription}"
                              </p>
                           </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-col sm:flex-row gap-4 pt-6">
                        <button 
                          onClick={() => act(p.id, "approve")}
                          disabled={acting === p.id}
                          className="flex-1 py-6 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-800 disabled:text-gray-500 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-3"
                        >
                          {acting === p.id ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <><CheckCircle2 size={18} /> Publicar no Catálogo</>
                          )}
                        </button>
                        <button 
                          onClick={() => act(p.id, "reject")}
                          disabled={acting === p.id}
                          className="px-12 py-6 bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/20 rounded-[2rem] font-black text-xs uppercase tracking-widest text-gray-500 hover:text-rose-500 transition-all flex items-center justify-center gap-3 active:scale-95"
                        >
                          <XSquare size={18} /> Rejeitar
                        </button>
                      </div>

                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="relative z-10 border-t border-white/5 py-12 px-6 text-center">
         <p className="text-gray-600 text-[10px] font-black uppercase tracking-[0.3em]">IAmobil Intelligence — Approval Hub Mode</p>
      </footer>
    </div>
  );
}
