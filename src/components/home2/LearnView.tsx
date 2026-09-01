import { useState } from "react";
import { IconChevronLeft } from "@tabler/icons-react";
import { ARTICLES, Blocks, UPDATED, type Article } from "../Learn";

/**
 * The tax guides, inside the dashboard.
 *
 * Same words as the public `/learn` pages, laid out the way every other screen
 * in the app is: a scrolling card in the main column, the list and the article
 * swapped in place rather than routed, so the sidebar and the session stay put.
 */
export default function LearnView() {
  const [open, setOpen] = useState<Article | null>(null);

  if (!open) {
    return (
      <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl bg-white p-5 lg:p-8">
        <header className="shrink-0">
          <p className="text-sm text-ink/60">ความรู้ภาษี</p>
          <h1 className="mt-1 text-2xl text-ink">คู่มือสำหรับนักลงทุนหุ้นกู้</h1>
          <p className="mt-2 max-w-[46rem] text-sm leading-7 text-ink/60">
            ดอกเบี้ยหุ้นกู้ถูกหักภาษี ณ ที่จ่าย 15% เท่ากันทุกคน ทั้งที่ภาษีจริงคิดแบบขั้นบันได
            คนที่ฐานภาษีต่ำกว่านั้นจึงจ่ายเกินทุกงวด
          </p>
        </header>

        <ul className="mt-6 grid min-h-0 flex-1 content-start gap-4 overflow-y-auto lg:grid-cols-3">
          {ARTICLES.map((a) => (
            <li key={a.slug}>
              <button
                onClick={() => setOpen(a)}
                className="flex h-full w-full flex-col rounded-2xl border border-line p-5 text-left transition hover:bg-black/5"
              >
                <h2 className="text-base leading-snug text-ink">{a.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-7 text-ink/60">{a.description}</p>
                <p className="mt-4 text-sm text-brand-blue">อ่าน {a.minutes} นาที →</p>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl bg-white">
      <header className="shrink-0 border-b border-line px-5 py-4 lg:px-8">
        <button
          onClick={() => setOpen(null)}
          className="flex items-center gap-1 rounded-full py-1 pl-1 pr-3 text-sm text-brand transition hover:bg-black/5"
        >
          <IconChevronLeft size={18} />
          คู่มือทั้งหมด
        </button>
      </header>

      <article className="min-h-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-[46rem]">
          <h1 className="text-2xl leading-snug text-ink">{open.title}</h1>
          <p className="mt-2 text-sm text-ink/45">
            อัปเดต {UPDATED} · อ่าน {open.minutes} นาที
          </p>
          <p className="mt-5 text-[15px] leading-8 text-ink/70">{open.description}</p>
          <Blocks blocks={open.blocks} />
        </div>
      </article>
    </section>
  );
}
