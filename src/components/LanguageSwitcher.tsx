"use client";

import { useLanguage } from "@/lib/i18n";

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="glass-panel flex gap-1 p-1 pointer-events-auto">
      <button
        onClick={() => setLanguage("en")}
        className={`px-3 py-1.5 text-[10px] font-mono tracking-wider transition-all cursor-pointer ${
          language === "en"
            ? "bg-[var(--gold-primary)] text-black"
            : "text-[var(--text-muted)] hover:text-[var(--text-heading)]"
        }`}
      >
        {t("language.en")}
      </button>
      <button
        onClick={() => setLanguage("tr")}
        className={`px-3 py-1.5 text-[10px] font-mono tracking-wider transition-all cursor-pointer ${
          language === "tr"
            ? "bg-[var(--gold-primary)] text-black"
            : "text-[var(--text-muted)] hover:text-[var(--text-heading)]"
        }`}
      >
        {t("language.tr")}
      </button>
    </div>
  );
}
