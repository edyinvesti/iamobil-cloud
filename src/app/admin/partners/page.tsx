"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Users, Share2, QrCode, Download, MessageCircle, Link as LinkIcon, Sparkles } from 'lucide-react';

export default function AdminPartners() {
  const landingPageUrl = "http://192.168.0.6:3000/parceiros";
  const gestorAppUrl = "http://192.168.0.6:5173";
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(landingPageUrl)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(landingPageUrl);
    alert("🔗 Link da Landing Page copiado!");
  };

  const handleWhatsAppShare = () => {
    const text = `Olá! Sabia que a iAmobil agora tem um portal exclusivo para corretores parceiros? \n\nLá você usa Inteligência Artificial para gerar descrições de luxo e sincroniza suas captações direto com nosso HUB. \n\nAcesse aqui: ${landingPageUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-12">
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-2">
          <Users className="text-orange-500" size={24} />
          <h1 className="text-3xl font-black tracking-tight text-gray-900 uppercase">Gestão de Parceiros</h1>
        </div>
        <p className="text-gray-500 font-medium">Kit de marketing e ferramentas de convite para corretores de elite.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Marketing Kit Card */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
            <div className="p-10 border-b border-gray-50 bg-gradient-to-r from-orange-500/5 to-transparent">
              <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                <Sparkles className="text-orange-500" size={20} /> Kit de Convite Viral
              </h2>
            </div>
            
            <div className="p-10 flex flex-col md:flex-row gap-12 items-center">
              <div className="flex-1 space-y-6">
                <div>
                  <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest mb-4">Link Público</h3>
                  <div className="flex gap-2">
                    <input 
                      readOnly 
                      value={landingPageUrl}
                      className="flex-1 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 text-sm font-medium text-gray-600 outline-none"
                    />
                    <button 
                      onClick={handleCopyLink}
                      className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
                    >
                      <LinkIcon size={18} className="text-gray-600" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button 
                    onClick={handleWhatsAppShare}
                    className="flex items-center justify-center gap-3 px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                  >
                    <MessageCircle size={18} /> Enviar no WhatsApp
                  </button>
                  <a 
                    href={qrCodeUrl} 
                    download="QR_IAmobil_Parceiros.png"
                    className="flex items-center justify-center gap-3 px-6 py-4 bg-gray-900 hover:bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-gray-900/20"
                  >
                    <Download size={18} /> Baixar QR Code
                  </a>
                </div>
              </div>

              <div className="w-full md:w-64 aspect-square bg-gray-50 rounded-[2rem] border border-gray-100 p-6 flex flex-col items-center justify-center transition-transform hover:scale-105">
                 <img 
                    src={qrCodeUrl} 
                    alt="QR Code Parceiros" 
                    className="w-full h-full object-contain mix-blend-multiply"
                 />
                 <span className="text-[10px] font-black uppercase text-gray-400 mt-4 tracking-widest">Digital Scanner</span>
              </div>
            </div>
          </div>

          {/* Social Stats Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                   <div className="p-3 bg-blue-50 rounded-2xl text-blue-500"><Share2 size={24} /></div>
                   <h4 className="font-black uppercase text-xs tracking-widest text-gray-400">Alcance do Link</h4>
                </div>
                <div className="text-4xl font-black">0 <span className="text-xs font-bold text-gray-300">Cliques Hoje</span></div>
             </div>
             <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                   <div className="p-3 bg-purple-50 rounded-2xl text-purple-500"><Sparkles size={24} /></div>
                   <h4 className="font-black uppercase text-xs tracking-widest text-gray-400">Conversão IA</h4>
                </div>
                <div className="text-4xl font-black">0% <span className="text-xs font-bold text-gray-300">De Onboarding</span></div>
             </div>
          </div>
        </div>

        {/* Sidebar: Tips & Help */}
        <div className="space-y-6">
           <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white space-y-6">
              <h3 className="text-lg font-black uppercase tracking-tight text-orange-500">Como Convidar?</h3>
              <ul className="space-y-4">
                {[
                  "Poste o QR Code nos seus Stories com link na bio.",
                  "Mande o link nos grupos de corretores no WhatsApp.",
                  "Use o convite pré-escrito para parceiros estratégicos.",
                  "Mostre a 'Mágica IA' em reuniões presenciais."
                ].map((tip, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-400 font-medium leading-relaxed">
                    <span className="text-orange-500 font-black">•</span> {tip}
                  </li>
                ))}
              </ul>
              <button className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border border-white/10">
                Ver Tutorial Completo
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
