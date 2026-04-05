import Link from 'next/link'
import { Instrument_Serif, Noto_Sans_KR } from 'next/font/google'
import styles from './RagLanding.module.css'

const display = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-landing-display',
})

const sans = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-landing-sans',
})

const RAGAS_COMPARE = [
  {
    id: 'faithfulness',
    title: 'Faithfulness',
    plain: 0.8222222222222222,
    html: 0.8641666666666665,
  },
  {
    id: 'answer_relevancy',
    title: 'Answer relevancy',
    plain: 0.7767794353276842,
    html: 0.8524897350820912,
  },
]

function formatDeltaPct(plain, html) {
  if (plain <= 0) return '—'
  return `${(((html - plain) / plain) * 100).toFixed(1)}%`
}

/** 0~max 스케일 막대 너비(%) */
function barPct(value, max) {
  if (max <= 0) return 0
  return Math.min(100, Math.max(0, (value / max) * 100))
}

export default function RagLanding() {
  return (
    <div className={`${styles.landing} ${sans.className}`}>
      <section className={styles.hero} aria-labelledby="rag-hero-title">
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>RagBlog</p>
          <h1 id="rag-hero-title" className={`${styles.titleEn} ${display.className}`}>
            RagBlog: Your Data, Your Intelligence.
          </h1>
          <p className={styles.sloganKo}>
            남의 땅에 집을 짓지 마세요. 당신의 기록이 스스로 생각하는 지능이 되는 곳,{' '}
            <span className={styles.highlight}>RagBlog</span> — 플랫폼이 아니라{' '}
            <strong>내 데이터·내 지식</strong>에 기반한 블로그입니다.
          </p>
        </div>
      </section>

      <p className={styles.sectionLabel}>핵심 가치</p>
      <div className={styles.pillars}>
        <article className={styles.pillar}>
          <span className={styles.pillarIndex}>01</span>
          <h2 className={styles.pillarTitle}>데이터 주권이 보장되는 오픈소스 솔루션</h2>
          <p className={styles.pillarBody}>
            플랫폼의 제약 없이 내 서버에 직접 배포하고 관리하세요. 검색 색인부터 콘텐츠 제어권까지, 비즈니스의 핵심 자산인 데이터를
            100% 직접 소유합니다.
          </p>
        </article>
        <article className={styles.pillar}>
          <span className={styles.pillarIndex}>02</span>
          <h2 className={styles.pillarTitle}>검색 엔진(SEO)이 사랑하는 콘텐츠, AI가 응답하는 블로그</h2>
          <p className={styles.pillarBody}>
            글을 올리는 것만으로 SEO 최적화와 RAG 기반 챗봇 학습이 동시에 완료됩니다. 내 글을 근거로 답변하기 때문에 환각 현상
            (Hallucination) 걱정 없이 방문자에게 가장 정확한 정보를 전달합니다.
          </p>
        </article>
        <article className={styles.pillar}>
          <span className={styles.pillarIndex}>03</span>
          <h2 className={styles.pillarTitle}>24시간 멈추지 않는 &apos;1인 마케팅 자동화&apos;</h2>
          <p className={styles.pillarBody}>
            별도의 유료 상담 툴 없이도 블로그가 곧 FAQ이자 상담원이 됩니다. 단순 변동 사항 안내부터 심화 질문 응대까지 AI 챗봇이
            밤낮없이 처리하여 1인 창업가의 운영 부담을 획기적으로 줄여줍니다.
          </p>
        </article>
      </div>

      <section className={styles.vizSection} aria-labelledby="ragas-compare-title">
        <h2 id="ragas-compare-title" className={styles.vizSectionTitle}>
          RAGAS · 청킹 비교
        </h2>
        <p className={styles.vizSectionLead}>
          동일 질문·검색, 청킹만 변경 · 스케일 0~1 · <code className={styles.metricsCode}>gpt-4o-mini</code>
        </p>
        <div className={styles.vizLegend}>
          <span className={styles.vizLegendItem}>
            <span className={`${styles.vizDot} ${styles.vizDotPlain}`} aria-hidden />
            Plain
          </span>
          <span className={styles.vizLegendItem}>
            <span className={`${styles.vizDot} ${styles.vizDotHtml}`} aria-hidden />
            HTML
          </span>
        </div>
        <div className={styles.ragasChartGrid}>
          {RAGAS_COMPARE.map((m) => (
            <figure key={m.id} className={styles.vizFigure}>
              <figcaption className={styles.vizFigCaption}>
                <span className={styles.vizFigName}>{m.title}</span>
                <span className={styles.vizFigDelta}>{formatDeltaPct(m.plain, m.html)}</span>
              </figcaption>
              <div
                className={styles.vizBarBlock}
                role="img"
                aria-label={`${m.title}: Plain ${m.plain.toFixed(3)}, HTML ${m.html.toFixed(3)}`}
              >
                <div className={styles.vizBarRow}>
                  <span className={styles.vizBarTag}>Plain</span>
                  <div className={styles.vizBarTrack}>
                    <div className={styles.vizBarFillPlain} style={{ width: `${barPct(m.plain, 1)}%` }} />
                  </div>
                  <span className={styles.vizBarNum}>{m.plain.toFixed(3)}</span>
                </div>
                <div className={styles.vizBarRow}>
                  <span className={styles.vizBarTagEm}>HTML</span>
                  <div className={styles.vizBarTrack}>
                    <div className={styles.vizBarFillHtml} style={{ width: `${barPct(m.html, 1)}%` }} />
                  </div>
                  <span className={styles.vizBarNumEm}>{m.html.toFixed(3)}</span>
                </div>
              </div>
              <div className={styles.vizAxis} aria-hidden>
                <span>0</span>
                <span>0.5</span>
                <span>1</span>
              </div>
            </figure>
          ))}
        </div>
      </section>

      <section className={styles.about} aria-labelledby="about-ragblog">
        <h2 id="about-ragblog" className={styles.aboutLead}>
          RagBlog는 1인 개발자와 창업가를 위한, AI 기반 독립형 블로그·지식 허브입니다.
        </h2>
        <p className={styles.aboutBody}>
          플랫폼 종속에서 벗어나고자 하는 개발자에게 <strong>나만의 땅(Ownership)</strong>을 되찾아 주고, 그 위에 쌓인 글이{' '}
          <strong>검색·대화형 지능(Intelligence)</strong>으로 연결되는 흐름을 만듭니다. 전문 지식을 기록하고, 그 기록을 가장
          잘 아는 에이전트와 함께 기록 그 이상의 가치를 만들어가 보세요.
        </p>
      </section>

      <section className={styles.cta} aria-label="시작하기">
        <p className={styles.ctaTitle}>지금 당신의 지능을 쌓아보세요</p>
        <div className={styles.ctaButtons}>
          <Link href="/list" className={styles.ctaPrimary}>
            글 둘러보기
          </Link>
          <Link href="/write" className={styles.ctaSecondary}>
            새 글 쓰기
          </Link>
        </div>
        <p className={styles.note}>우측 하단 채팅으로 글 기반 질문을 시험해 볼 수 있습니다.</p>
      </section>
    </div>
  )
}
