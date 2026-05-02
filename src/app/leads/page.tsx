"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';

interface Lead {
  name: string;
  phone: string;
  interest: string;
  notes: string;
  score: number;
  status: string;
  date: string;
}

export default function LeadsDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState({ totalVgv: 0, count: 0, averageTicket: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leads")
      .then((res) => res.json())
      .then((data) => {
        setLeads(data.leads);
        setStats(data.stats);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      maximumFractionDigits: 0 
    }).format(value);
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return (
      <span className="bg-amber-500/10 text-amber-500 px-2 py-1 rounded text-[8px] font-black uppercase tracking-[0.2em] border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
        🏆 Gold Priority
      </span>
    );
    if (score >= 50) return (
      <span className="bg-slate-400/10 text-slate-300 px-2 py-1 rounded text-[8px] font-black uppercase tracking-[0.2em] border border-slate-400/30">
        🥈 Silver ({score})
      </span>
    );
    return (
      <span className="bg-orange-950/20 text-orange-700 px-2 py-1 rounded text-[8px] font-black uppercase tracking-[0.2em] border border-orange-900/20">
        🥉 Bronze ({score})
      </span>
    );
  };

  const sendCommand = async (action: string, leadName: string, leadPhone: string) => {
    alert(`Comando "${action}" enviado para a equipe sobre o lead ${leadName}.`);
    await fetch("/api/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, leadName, leadPhone })
    });
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-[#05070a] flex items-center justify-center text-white">
        <div className="text-xl font-light tracking-widest animate-pulse uppercase">Acessando Banco de Leads...</div>
      </div>
    );
  }

  const chartData = [
    { name: 'Frio', total: leads.filter(l => l.status === 'Frio').length },
    { name: 'Negociação', total: leads.filter(l => l.status === 'Negociação').length },
    { name: 'Fechado', total: leads.filter(l => l.status === 'Fechado').length }
  ];

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-200 font-sans">
      {/* Header Administrativo */}
      <header className="backdrop-blur-xl bg-slate-900/40 border-b border-white/5 px-8 py-5 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-cyan-600 rounded flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <span className="text-white font-bold">CRM</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-none">iAmobil Admin</h1>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Gestão de Leads & Oportunidades</p>
          </div>
        </div>
        <div className="flex gap-4">
          <Link href="/catalog" className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
            Ver Catálogo
          </Link>
          <Link href="/office" className="bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg text-sm text-white transition-all border border-white/10">
            Escritório 3D
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-12">
          {/* Métricas Principais - 1 Coluna */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/5 p-6 rounded-2xl shadow-2xl relative overflow-hidden group hover:border-cyan-500/30 transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">VGV Potencial</p>
              <h3 className="text-2xl font-bold text-white tracking-tight">{formatCurrency(stats.totalVgv)}</h3>
              <div className="mt-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></span>
                <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Em Negociação</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/5 p-6 rounded-2xl shadow-2xl relative overflow-hidden group">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Ticket Médio</p>
              <h3 className="text-xl font-bold text-slate-300 tracking-tight">{formatCurrency(stats.averageTicket)}</h3>
              <div className="mt-4 text-[10px] text-slate-500 font-bold uppercase tracking-wider">Por Lead</div>
            </div>
            
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/5 p-6 rounded-2xl shadow-2xl relative overflow-hidden group hover:border-green-500/30 transition-all">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Oportunidades</p>
              <h3 className="text-2xl font-bold text-white tracking-tight">{stats.count}</h3>
            </div>
          </div>

          {/* Gráfico CRM Analytics - 3 Colunas */}
          <div className="lg:col-span-3 bg-gradient-to-br from-slate-900/50 to-slate-950/80 border border-white/5 p-6 rounded-2xl shadow-2xl backdrop-blur-sm">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Pipeline de Vendas</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <XAxis dataKey="name" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.02)'}}
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    {
                      chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={
                          entry.name === 'Frio' ? '#334155' : 
                          entry.name === 'Negociação' ? '#06b6d4' : '#10b981'
                        } />
                      ))
                    }
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-end mb-10">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Painel de Clientes</h2>
            <p className="text-slate-400 mt-2">Você tem {leads.length} oportunidades registradas no momento.</p>
          </div>
          <div className="bg-cyan-500/10 border border-cyan-500/20 px-4 py-2 rounded-full text-cyan-400 text-xs font-bold uppercase tracking-widest">
            Filtro: Todos os Leads
          </div>
        </div>

        <div className="bg-slate-900/30 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-slate-400 text-xs font-bold uppercase tracking-widest">
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Contato</th>
                <th className="px-6 py-4">Interesse</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-500">
                    Nenhum lead capturado ainda. A equipe está em campo! 🚀
                  </td>
                </tr>
              ) : (
                leads.map((lead, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-6 text-sm text-slate-500">{lead.date}</td>
                    <td className="px-6 py-6">
                      <div className="text-white font-medium">{lead.name}</div>
                      <div className="text-xs text-slate-500 mt-1 truncate max-w-[200px] italic">"{lead.notes}"</div>
                    </td>
                    <td className="px-6 py-6 text-sm text-cyan-500 font-mono tracking-tighter">{lead.phone}</td>
                    <td className="px-6 py-6 font-medium text-slate-300 text-sm">{lead.interest}</td>
                    <td className="px-6 py-6">
                      {getScoreBadge(lead.score)}
                    </td>
                    <td className="px-6 py-6 border-white/5 border-l">
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => sendCommand("pressionar", lead.name, lead.phone)}
                          className="bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-cyan-500/20 transition-all flex items-center gap-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                          Pressionar
                        </button>
                        <button 
                          onClick={() => sendCommand("resumir", lead.name, lead.phone)}
                          className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-blue-500/20 transition-all flex items-center gap-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                          Resumir
                        </button>
                        <button 
                          onClick={async () => {
                            if (confirm(`Deseja realmente excluir o lead ${lead.name}?`)) {
                              const res = await fetch("/api/leads", {
                                method: "DELETE",
                                body: JSON.stringify({ name: lead.name, phone: lead.phone }),
                                headers: { "Content-Type": "application/json" }
                              });
                              if (res.ok) window.location.reload();
                            }
                          }}
                          className="text-slate-500 hover:text-red-400 transition-colors text-[10px] uppercase tracking-wider font-semibold mt-1"
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      <footer className="py-20 text-center">
        <div className="w-24 h-[1px] bg-gradient-to-r from-transparent via-slate-800 to-transparent mx-auto mb-8"></div>
        <p className="text-slate-600 text-xs uppercase tracking-[0.2em]">&copy; 2026 iAmobil Luxury Real Estate Intelligence</p>
      </footer>
    </div>
  );
}
