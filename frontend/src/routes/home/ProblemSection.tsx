export function ProblemSection() {
  return (
    <>
      <div className="landing-tear landing-tear-dark" />
      <section className="bg-accent px-6 py-24 text-button-text sm:py-32">
        <div className="mx-auto max-w-[calc(80rem-3rem)]">
          <p className="landing-eyebrow text-white/50">The queue costs more than time</p>
          <h2 className="landing-display mt-4 max-w-5xl text-[clamp(3.2rem,7vw,6.5rem)] leading-[0.86]">
            YOUR BEST MOMENTS
            <br />
            SHOULDN&apos;T HAPPEN
            <br />
            <span className="text-button-text/65">IN A LINE.</span>
          </h2>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {[
              [
                '01',
                'Guests miss the event',
                'Long waits pull people away from stages, friends and the moments they came for.',
              ],
              [
                '02',
                'Teams lose the overview',
                'Paper tickets and shouted order numbers make every rush harder to manage.',
              ],
              [
                '03',
                'Revenue stops at the queue',
                'When the line looks too long, guests skip the second round before it starts.',
              ],
            ].map(([number, title, copy], index) => (
              <article
                className={`landing-problem-card ${index === 1 ? 'md:translate-y-6 md:rotate-1' : index === 2 ? 'md:-rotate-1' : 'md:-rotate-2'}`}
                key={number}
              >
                <span className="text-xs font-black tracking-widest text-white/50">{number}</span>
                <h3 className="mt-14 text-2xl font-black uppercase leading-none">{title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-white/65">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <div className="landing-tear landing-tear-light" />
    </>
  );
}
