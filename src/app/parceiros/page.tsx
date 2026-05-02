"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Zap, ShieldCheck, ArrowRight, CheckCircle2, Star } from 'lucide-react';

export default function PartnersLanding() {
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-orange-500 selection:text-white overflow-hidden">
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-20 md:py-32">
        {/* Header Section */}
        <div className="flex flex-col items-center text-center space-y-8 mb-24">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-4 py-2 rounded-full bg-white/5 border border-white/10 flex items-center gap-2 text-orange-400 text-xs font-black uppercase tracking-[0.2em]"
          >
            <Sparkles size={14} /> Portal do Parceiro iAmobil
          </motion.div>
          
          <motion.h1 
             initial={{ opacity:0, y: 20 }}
             animate={{ opacity:1, y: 0 }}
             transition={{ delay: 0.1 }}
             className="text-5xl md:text-8xl font-black tracking-tighter leading-[0.9] max-w-4xl"
          >
            TRANSFORME SUAS CAPTAÇÕES EM <span className="text-orange-500">OURO</span> DIGITAL.
          </motion.h1>

          <motion.p 
            initial={{ opacity:0, y: 20 }}
            animate={{ opacity:1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-gray-400 text-lg md:text-xl max-w-2xl leading-relaxed"
          >
            Use a inteligência artificial mais avançada do mercado imobiliário para criar anúncios irresistíveis e vender mais rápido.
          </motion.p>

          <motion.div 
            initial={{ opacity:0, y: 20 }}
            animate={{ opacity:1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <a 
               href="http://192.168.0.6:5173" 
               className="px-12 py-6 bg-orange-500 hover:bg-orange-600 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-2xl shadow-orange-500/20 active:scale-95 flex items-center gap-3"
            >
              Começar Agora Gratuitamente <ArrowRight size={18} />
            </a>
            <a 
               href="#beneficios" 
               className="px-12 py-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95"
            >
            Ver Benefícios
          </a>
        </motion.div>
      </div>


        {/* Features Grid */}
        <div id="beneficios" className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-32">
          {[
            {
              icon: <Zap className="text-orange-500" />,
              title: "Mágica IA",
              desc: "Nossa IA escreve descrições luxuosas e persuasivas baseadas na ficha técnica do seu imóvel em segundos."
            },
            {
              icon: <ShieldCheck className="text-emerald-500" />,
              title: "Curadoria Premium",
              desc: "Seus imóveis passam por uma análise técnica e zoneamento oficial, garantindo segurança jurídica total."
            },
            {
              icon: <Star className="text-purple-500" />,
              title: "Rede de Vendas",
              desc: "Direcionamos leads qualificados da iAmobil para suas captações. Você foca em captar, nós ajudamos a vender."
            }
          ].map((f, i) => (
             <motion.div 
               key={i}
               initial={{ opacity:0, y: 20 }}
               whileInView={{ opacity:1, y: 0 }}
               viewport={{ once: true }}
               transition={{ delay: i * 0.1 }}
               className="p-10 rounded-[3rem] bg-white/5 border border-white/10 hover:border-orange-500/30 transition-all group"
             >
               <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                 {f.icon}
               </div>
               <h3 className="text-2xl font-bold mb-4">{f.title}</h3>
               <p className="text-gray-400 leading-relaxed font-medium">{f.desc}</p>
             </motion.div>
          ))}
        </div>

        {/* Social Proof / Numbers */}
        <div className="rounded-[4rem] bg-gradient-to-br from-orange-500 to-orange-600 p-12 md:p-24 flex flex-col md:flex-row items-center justify-between gap-12 text-black">
          <div className="space-y-4 text-center md:text-left">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-none">
              PRONTO PARA <br/> SUBIR O NÍVEL?
            </h2>
            <p className="text-black/60 font-bold max-w-sm">Junte-se a rede de corretores de elite que está dominando o mercado de luxo de Goiás.</p>
          </div>
          <div className="flex flex-col gap-4 w-full md:w-auto">
             <div className="flex items-center gap-4 bg-black/10 p-6 rounded-3xl border border-black/5 backdrop-blur-sm">
                <CheckCircle2 size={32} />
                <div>
                   <div className="text-2xl font-black">100% Digital</div>
                   <div className="text-xs font-bold uppercase opacity-60">Sem burocracia</div>
                </div>
             </div>
             <div className="flex items-center gap-4 bg-black/10 p-6 rounded-3xl border border-black/5 backdrop-blur-sm">
                <CheckCircle2 size={32} />
                <div>
                   <div className="text-2xl font-black">Gratuito</div>
                   <div className="text-xs font-bold uppercase opacity-60">Para parceiros exclusivos</div>
                </div>
             </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-12 px-6 flex flex-col md:flex-row items-center justify-between gap-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center font-black text-xs">IA</div>
          <span className="font-black tracking-widest text-sm uppercase">iAmobil</span>
        </div>
        <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">
           © 2026 IAmobil - Inteligência Imobiliária de Vanguarda
        </div>
      </footer>
    </div>
  );
}
