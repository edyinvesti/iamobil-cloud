"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

interface Property {
  id: string;
  name: string;
  location: string;
  price: string;
  area: string;
  rooms: string;
  highlight: string;
  image: string;
}

export default function CatalogPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/api/catalog")
      .then((res) => res.json())
      .then((data) => {
        setProperties(data.properties);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredProperties = useMemo(() => {
    return properties.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           p.location.toLowerCase().includes(searchTerm.toLowerCase());
      if (filter === "all") return matchesSearch;
      if (filter === "luxo") return matchesSearch && parseInt(p.price.replace(/\D/g, "")) > 3000000;
      return matchesSearch;
    });
  }, [properties, searchTerm, filter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-2xl font-light tracking-widest animate-pulse font-serif italic">iAmobil...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-200 font-sans selection:bg-orange-500/30">
      {/* Header Premium */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#020408]/80 border-b border-white/5 px-8 py-5 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/10">
            <span className="text-white font-black text-xl tracking-tighter">iA</span>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white leading-none">
              iAmobil <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent italic font-medium ml-1">Properties</span>
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-bold">Goiânia Luxury Portfolio</p>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-6">
          <Link href="/office" className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Acessar Office</Link>
          <Link href="/admin/approval" className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-cyan-400 transition-colors">Painel Admin</Link>
          <Link 
            href="/office" 
            className="px-6 py-2.5 rounded-full bg-white text-black hover:bg-cyan-400 transition-all text-xs font-bold tracking-widest shadow-xl shadow-cyan-500/5"
>          FALAR COM AGENTE
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-16">
        <div className="mb-20 text-center relative">
          <h2 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter leading-tight">
            Curadoria de <br/>
            <span className="bg-gradient-to-b from-white via-white to-slate-500 bg-clip-text text-transparent">Imóveis Extraordinários</span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg md:text-xl font-light leading-relaxed">
            Exploração imobiliária de elite em Goiás, filtrada por <span className="text-cyan-400 font-medium">Maria (Nossa IA)</span> para garantir apenas o que há de melhor.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-16 items-center justify-between p-2 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-md">
          <div className="relative flex-1 w-full">
            <svg className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input 
              type="text" 
              placeholder="Buscar por nome, setor ou cidade..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-0 pl-14 pr-6 py-4 text-white placeholder:text-slate-600 font-medium text-sm"
            />
          </div>
          <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
            <button 
              onClick={() => setFilter("all")}
              className={`px-5 py-2.5 rounded-lg text-xs font-black tracking-widest uppercase transition-all ${filter === 'all' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'text-slate-500 hover:text-white'}`}
            >Todos</button>
            <button 
              onClick={() => setFilter("luxo")}
              className={`px-5 py-2.5 rounded-lg text-xs font-black tracking-widest uppercase transition-all ${filter === 'luxo' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-white'}`}
            >Mansões +3M</button>
          </div>
        </div>

        {/* Grid de Imóveis */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {filteredProperties.length > 0 ? filteredProperties.map((prop, idx) => (
            <div 
              key={idx} 
              className="group relative flex flex-col bg-[#080a0f] border border-white/5 rounded-[32px] overflow-hidden hover:border-cyan-500/30 transition-all duration-700 hover:shadow-[0_20px_50px_rgba(0,190,255,0.1)]"
            >
              {/* Imagem com Overlay */}
              <div className="relative h-80 overflow-hidden">
                <img 
                  src={prop.image} 
                  alt={prop.name} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2000ms] ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#080a0f] via-transparent to-transparent opacity-90"></div>
                <div className="absolute top-6 left-6 flex gap-2">
                   <div className="backdrop-blur-md bg-white/10 border border-white/20 px-4 py-1.5 rounded-full text-[10px] font-black text-white uppercase tracking-tighter">
                    Destaque iA
                  </div>
                </div>
              </div>

              {/* Conteúdo */}
              <div className="p-8 pt-2 flex flex-col flex-1">
                <div className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.2em] mb-3">
                  {prop.location}
                </div>
                <h3 className="text-2xl font-bold text-white mb-4 leading-tight group-hover:text-cyan-400 transition-colors">
                  {prop.name}
                </h3>
                <p className="text-slate-400 text-sm mb-8 line-clamp-2 font-light leading-relaxed">
                  {prop.highlight}
                </p>

                <div className="flex gap-6 mb-8 mt-auto py-5 border-y border-white/5">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-1">Área</span>
                    <span className="text-white font-bold text-sm tracking-tight">{prop.area}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-1">Planta</span>
                    <span className="text-white font-bold text-sm tracking-tight">{prop.rooms}</span>
                  </div>
                </div>

                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest block mb-1">Investimento</span>
                    <div className="text-2xl font-black text-white tracking-tighter">
                      {prop.price}
                    </div>
                  </div>
                  <button className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center text-black hover:bg-cyan-400 transition-all hover:-translate-y-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                  </button>
                </div>
              </div>
            </div>
          )) : (
            <div className="col-span-full py-32 text-center">
               <div className="text-4xl grayscale opacity-20 mb-6">🏘️</div>
               <p className="text-slate-500 font-medium">Nenhum imóvel encontrado nesta seleção.</p>
            </div>
          )}
        </div>
      </main>

      <footer className="py-24 border-t border-white/5 text-center mt-20">
        <div className="w-10 h-10 bg-slate-900 rounded-lg mx-auto mb-8 flex items-center justify-center border border-white/5">
           <span className="text-white font-bold text-sm">iA</span>
        </div>
        <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.3em] mb-4">iAmobil Luxury Estates — Goiânia</p>
        <p className="text-slate-700 text-[9px] max-w-xs mx-auto">Tecnologia, curadoria humana e inteligência artificial para conexões imobiliárias sem precedentes.</p>
      </footer>

      <style jsx>{`
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}

