import Link from "next/link";
import { Home, AlertTriangle } from "lucide-react";

export default function InvalidRoutePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white font-sans p-4">
      <div className="max-w-md w-full text-center space-y-8 transition-all">
        <div className="relative inline-block">
          <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-amber-600 rounded-full blur opacity-40"></div>
          <div className="relative bg-[#1a1a1a] p-6 rounded-full border border-white/10">
            <AlertTriangle className="w-16 h-16 text-amber-500" />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
            404
          </h1>
          <h2 className="text-xl font-medium text-white/80">Esta página não existe</h2>
          <p className="text-white/40 leading-relaxed">
            O endereço que você tentou acessar no ecossistema iAmobil é inválido ou foi movido.
          </p>
        </div>

        <div className="pt-8">
          <Link
            href="/office"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-all active:scale-95 shadow-xl shadow-white/10"
          >
            <Home className="w-5 h-5" />
            Voltar ao Office
          </Link>
        </div>
      </div>
    </div>
  );
}

