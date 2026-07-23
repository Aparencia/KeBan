import Link from "next/link";

/**
 * 页脚 — 克制、留白、品牌语料收尾
 */
export function Footer() {
  return (
    <footer className="relative mt-32 pb-12">
      <div className="feather-divider max-w-4xl mx-auto mb-12" />
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* 品牌 */}
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2.5 mb-3">
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                style={{ background: "linear-gradient(135deg, var(--kb-brand-400), var(--kb-accent-500))" }}
              >
                熵
              </span>
              <span className="font-serif font-semibold text-kb-text">课伴 · 熵减</span>
            </div>
            <p className="text-sm text-kb-text3 max-w-xs leading-relaxed">
              万物终将冷却，但你可以选择向内心注入光。
              <br />
              在无序的宇宙中，你不是一个人。
            </p>
          </div>

          {/* 链接 */}
          <div className="flex gap-12 text-sm">
            <div className="flex flex-col gap-2.5">
              <span className="text-kb-text3 text-xs uppercase tracking-widest mb-1">导航</span>
              <Link href="/" className="text-kb-text2 hover:text-kb-text transition-colors duration-300">首页</Link>
              <Link href="/story" className="text-kb-text2 hover:text-kb-text transition-colors duration-300">品牌故事</Link>
              <Link href="/download" className="text-kb-text2 hover:text-kb-text transition-colors duration-300">下载</Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="text-kb-text3 text-xs uppercase tracking-widest mb-1">开源</span>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-kb-text2 hover:text-kb-text transition-colors duration-300"
              >
                GitHub
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-kb-text2 hover:text-kb-text transition-colors duration-300"
              >
                更新日志
              </a>
            </div>
          </div>
        </div>

        {/* 底栏 */}
        <div className="mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-kb-text3"
          style={{ borderTop: "1px solid var(--kb-border-default)" }}
        >
          <span>© 2026 课伴 KeBan · 熵减 — 在无序的时光里，陪你慢慢生长</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full animate-cyber-pulse" style={{ background: "var(--kb-cyber-cyan)" }} />
            以负熵为食的生命体
          </span>
        </div>
      </div>
    </footer>
  );
}
