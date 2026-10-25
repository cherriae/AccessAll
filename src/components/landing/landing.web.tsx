import 'maplibre-gl/dist/maplibre-gl.css';
import './landing.css';

import { Map as MapLibreMap, Marker as MapLibreMarker, type StyleSpecification } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { useElevatorOutages } from '@/hooks/useElevatorOutages';
import { useImpactSummary } from '@/hooks/useImpact';
import { usePlacesInBounds } from '@/hooks/usePlaces';
import { useReports } from '@/hooks/useReports';
import { ACCESS_NEED_LABELS, accessFit } from '@/lib/access-fit';
import { ACCESS_NEEDS, type AccessNeed, type MapBounds } from '@/types';

import type { LandingProps } from './landing';

/** Downtown Brooklyn and Lower Manhattan: where AccessAll started, and dense with stations. */
const HOME = { latitude: 40.705, longitude: -73.985 };
const NYC: MapBounds = { minLatitude: 40.57, minLongitude: -74.08, maxLatitude: 40.82, maxLongitude: -73.86 };

const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

/** Stable empty list, so memoised pins do not rebuild every render while loading. */
const NONE: never[] = [];

type PinKind = 'barrier' | 'quiet' | 'elevator' | 'place';
interface HeroPin { id: string; kind: PinKind; latitude: number; longitude: number; label: string }

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Adds `is-visible` once the element scrolls into view, for CSS reveals. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  // Without motion (or an observer to drive it) there is nothing to wait for.
  const [visible, setVisible] = useState(() => prefersReducedMotion() || typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return [ref, visible] as const;
}

/** Counts up to `value` when first shown. Static for reduced-motion users. */
function CountUp({ value, active }: { value: number; active: boolean }) {
  const [shown, setShown] = useState(0);
  const still = prefersReducedMotion();

  useEffect(() => {
    if (!active || still) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 1400);
      setShown(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, value, still]);

  return <>{(still ? value : shown).toLocaleString()}</>;
}

function Reveal({ children, className = '', as: Tag = 'section', id, label }: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div';
  id?: string;
  label?: string;
}) {
  const [ref, visible] = useReveal<HTMLElement>();
  return (
    <Tag ref={ref as never} id={id} aria-label={label} className={`${className} reveal ${visible ? 'is-visible' : ''}`}>
      {children}
    </Tag>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero map                                                                   */
/* -------------------------------------------------------------------------- */

function HeroMap({ pins, onPin }: { pins: HeroPin[]; onPin: (pin: HeroPin) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<MapLibreMarker[]>([]);
  const onPinRef = useRef(onPin);
  useEffect(() => { onPinRef.current = onPin; }, [onPin]);

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new MapLibreMap({
      container: container.current,
      style: MAP_STYLE,
      center: [HOME.longitude, HOME.latitude],
      zoom: 11.9,
      pitch: 52,
      bearing: -18,
      interactive: false,
      attributionControl: { compact: true },
    });
    map.current = instance;
    // The headline card covers the left of the hero on wide screens; centre
    // the city in the space to its right so the live pins are not hidden.
    if (window.innerWidth > 900) {
      instance.setPadding({ left: Math.round(window.innerWidth * 0.42), top: 0, right: 0, bottom: 0 });
    }

    // A slow, endless drift: the city turning under you. Paused when the tab
    // is hidden, and never started for people who asked for less motion.
    let stopped = prefersReducedMotion();
    const drift = () => {
      if (stopped || document.hidden) return;
      instance.easeTo({ bearing: instance.getBearing() + 40, duration: 40_000, easing: (t) => t });
    };
    const onVisibility = () => { if (!document.hidden) drift(); };
    instance.on('load', drift);
    instance.on('moveend', drift);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisibility);
      instance.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    markers.current.forEach((marker) => marker.remove());
    markers.current = pins.map((pin, index) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = `pin pin--${pin.kind}`;
      element.tabIndex = -1;
      element.title = pin.label;
      element.style.setProperty('--delay', `${Math.min(index, 40) * 70 + 500}ms`);
      element.innerHTML = '<span class="pin__body"><span class="pin__core"></span></span>';
      element.onclick = () => onPinRef.current(pin);
      return new MapLibreMarker({ element }).setLngLat([pin.longitude, pin.latitude]).addTo(instance);
    });
  }, [pins]);

  return <div ref={container} className="hero__map" aria-hidden="true" />;
}

/* -------------------------------------------------------------------------- */
/* Needs demo                                                                 */
/* -------------------------------------------------------------------------- */

/** An illustrative place for the demo; labelled as an example on the page. */
const SAMPLE_PLACE = {
  quietScore: 72,
  features: [
    { id: 'accessible-entrance', label: 'Accessible entrance', icon: 'ramp' as const },
    { id: 'elevator', label: 'Elevator', icon: 'elevator' as const },
    { id: 'hearing-loop', label: 'Hearing loop', icon: 'hearing' as const },
    { id: 'sensory-support', label: 'Sensory support', icon: 'quiet' as const },
  ],
};

function NeedsDemo() {
  const [needs, setNeeds] = useState<AccessNeed[]>(['wheelchair']);
  const fit = accessFit(SAMPLE_PLACE, needs);

  return (
    <div className="demo">
      <div className="demo__chips" role="group" aria-label="Choose access needs">
        {ACCESS_NEEDS.map((need) => {
          const on = needs.includes(need);
          return (
            <button
              key={need}
              type="button"
              aria-pressed={on}
              className={`chip ${on ? 'chip--on' : ''}`}
              onClick={() => setNeeds((current) => (on ? current.filter((value) => value !== need) : [...current, need]))}
            >
              <span className="chip__dot" aria-hidden="true" />
              {ACCESS_NEED_LABELS[need].title}
            </button>
          );
        })}
      </div>

      <article className="place-card" aria-live="polite">
        <p className="place-card__eyebrow">Example place · a public library</p>
        <div className="place-card__row">
          <div className="ring" style={{ '--score': fit?.score ?? 0 } as CSSProperties} role="img" aria-label={fit ? `${fit.score} percent fit` : 'No needs chosen'}>
            <span>{fit ? `${fit.score}%` : '—'}</span>
          </div>
          <div>
            <h3 className="place-card__title">{fit ? (fit.score >= 75 ? 'A great fit for you' : fit.score >= 40 ? 'Partly fits you' : 'Not confirmed for you yet') : 'Pick a need'}</h3>
            <p className="place-card__sub">Scored from what the community has confirmed.</p>
          </div>
        </div>
        <ul className="place-card__list">
          {fit?.confirmed.map((label) => <li key={label} className="ok">{label}</li>)}
          {fit?.notConfirmed.map((label) => <li key={label} className="unknown">{label} · not confirmed yet</li>)}
        </ul>
      </article>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export function Landing({ onEnter }: LandingProps) {
  const places = usePlacesInBounds(NYC).data ?? NONE;
  const reports = useReports().data ?? NONE;
  const outages = useElevatorOutages(true).data ?? NONE;
  const impact = useImpactSummary().data;
  const [statsRef, statsVisible] = useReveal<HTMLDivElement>();

  // A shared link like /#impact: the browser tries to jump before these
  // sections exist, so do it once they have rendered.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, []);

  const pins = useMemo<HeroPin[]>(() => [
    ...reports
      .filter((report) => report.status !== 'resolved' && report.latitude !== null && report.longitude !== null)
      .map((report) => ({ id: report.id, kind: 'barrier' as const, latitude: report.latitude!, longitude: report.longitude!, label: report.title })),
    ...places
      .filter((place) => (place.quietScore ?? 0) >= 60)
      .map((place) => ({ id: place.id, kind: 'quiet' as const, latitude: place.latitude, longitude: place.longitude, label: place.name })),
    ...places
      .filter((place) => (place.quietScore ?? 0) < 60)
      .map((place) => ({ id: place.id, kind: 'place' as const, latitude: place.latitude, longitude: place.longitude, label: place.name })),
    ...outages.map((outage) => ({ id: outage.equipment, kind: 'elevator' as const, latitude: outage.latitude, longitude: outage.longitude, label: `Elevator out · ${outage.station}` })),
  ], [reports, places, outages]);

  const counts = {
    barrier: pins.filter((pin) => pin.kind === 'barrier').length,
    quiet: pins.filter((pin) => pin.kind === 'quiet').length,
    elevator: outages.length,
  };

  const communityStats = [
    { label: 'barriers reported', value: impact?.reportsTotal ?? 0 },
    { label: 'fixed', value: impact?.reportsResolved ?? 0, mint: true },
    { label: 'times someone said “this affects me”', value: impact?.peopleAffected ?? 0 },
  ].filter((stat) => stat.value > 0);

  const ticker = [
    ...reports.filter((report) => report.status !== 'resolved').slice(0, 8).map((report) => `${report.title} · ${report.location}`),
    ...outages.slice(0, 8).map((outage) => `Elevator out at ${outage.station} (${outage.lines})`),
  ];

  function openPin(pin: HeroPin) {
    if (pin.kind === 'barrier') onEnter(`/report/${pin.id}`);
    else if (pin.kind === 'elevator') onEnter('/explore');
    else onEnter(`/place/${pin.id}`);
  }

  return (
    <div className="landing">
      <a className="skip-link" href="#main">Skip to content</a>

      <header className="nav">
        <a className="brand" href="/" aria-label="AccessAll home">
          <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 2c-6.1 0-11 4.8-11 10.8C5 21 16 30 16 30s11-9 11-17.2C27 6.8 22.1 2 16 2z" fill="currentColor" />
            <circle cx="16" cy="10" r="2.6" fill="#0A0E1A" />
            <path d="M10.5 13.5l5.5 1.2 5.5-1.2M16 14.7v4.6M16 19.3l-3 4.2M16 19.3l3 4.2" stroke="#0A0E1A" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </svg>
          <span>AccessAll</span>
        </a>
        <nav className="nav__links" aria-label="Main">
          <a href="#how">How it works</a>
          <a href="#for-you">For you</a>
          <a href="#impact">Impact</a>
          <button type="button" className="nav__signin" onClick={() => onEnter('/auth')}>Sign in</button>
        </nav>
      </header>

      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <HeroMap pins={pins} onPin={openPin} />
          <div className="hero__veil" aria-hidden="true" />
          <div className="hero__grain" aria-hidden="true" />

          <div className="hero__card">
            <p className="eyebrow"><span className="live-dot" aria-hidden="true" /> Live from New York City</p>
            <h1 id="hero-title" className="hero__title">
              See your city the way <span className="swash">everyone</span> needs to.
            </h1>
            <p className="hero__lede">
              Students map the ramps, elevators, quiet corners and broken doors nobody else tracks,
              then get them fixed. Every pin on this map is real.
            </p>
            <div className="hero__ctas">
              <button type="button" className="btn btn--primary" onClick={() => onEnter('/explore')}>
                Explore the map <span aria-hidden="true">→</span>
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => onEnter('/auth?mode=signup')}>
                Report a barrier
              </button>
            </div>
            <ul className="legend" aria-label="On the map right now">
              {counts.barrier > 0 ? <li><span className="legend__dot legend__dot--barrier" aria-hidden="true" />{counts.barrier} open barriers</li> : null}
              {counts.quiet > 0 ? <li><span className="legend__dot legend__dot--quiet" aria-hidden="true" />{counts.quiet} quiet places</li> : null}
              <li><span className="legend__dot legend__dot--elevator" aria-hidden="true" />{counts.elevator} elevators out now</li>
            </ul>
          </div>

          <a href="#how" className="scroll-cue" aria-label="Scroll to how it works"><span /></a>
        </section>

        {ticker.length > 0 ? (
          <div className="ticker" role="region" aria-label="Latest from the map">
            <span className="ticker__badge">Live</span>
            <div className="ticker__track">
              <ul className="ticker__list">
                {[...ticker, ...ticker].map((item, index) => (
                  <li key={index} aria-hidden={index >= ticker.length}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        <Reveal className="how" id="how" label="How it works">
          <p className="kicker">How it works</p>
          <h2 className="section-title">A blocked ramp is a<br />five-minute fix. <em>If someone says so.</em></h2>
          <ol className="steps">
            <li className="step">
              <span className="step__num">01</span>
              <h3>Report it</h3>
              <p>Pin the barrier on the map in seconds: a locked accessible door, a dead elevator, a hallway too loud to think in.</p>
            </li>
            <li className="step">
              <span className="step__num">02</span>
              <h3>Rally</h3>
              <p>Classmates who hit the same barrier tap “affects me”. One tap writes a formal letter to the school, evidence and all.</p>
            </li>
            <li className="step">
              <span className="step__num">03</span>
              <h3>Get it fixed</h3>
              <p>Staff post updates with photo proof. Everyone affected hears the moment it is resolved.</p>
            </li>
          </ol>
        </Reveal>

        <Reveal className="for-you" id="for-you" label="Built for you">
          <div className="for-you__copy">
            <p className="kicker kicker--light">Built for how you move</p>
            <h2 className="section-title section-title--light">“Accessible” means something different to everyone.</h2>
            <p className="for-you__lede">
              Tell AccessAll what you need once. Every place gets a fit score for you, built from what people
              actually confirmed, and honest about what nobody has checked yet. Try it:
            </p>
          </div>
          <NeedsDemo />
        </Reveal>

        <section className="impact" id="impact" aria-labelledby="impact-title">
          <h2 id="impact-title" className="visually-hidden">Impact so far</h2>
          <div ref={statsRef} className="impact__grid">
            {/* Only real numbers: a row of zeros on a new community says "dead",
                so before the first report it says "be first" instead. */}
            {communityStats.length > 0 ? (
              communityStats.map((stat) => (
                <div key={stat.label} className={`stat ${stat.mint ? 'stat--mint' : ''}`}>
                  <span className="stat__value"><CountUp value={stat.value} active={statsVisible} /></span>
                  <span className="stat__label">{stat.label}</span>
                </div>
              ))
            ) : (
              <div className="stat stat--wide">
                <span className="stat__value stat__value--text">Be one of the first.</span>
                <span className="stat__label">AccessAll is just starting at Brooklyn Tech. The first reports shape what gets fixed.</span>
              </div>
            )}
            {outages.length > 0 ? (
              <div className="stat"><span className="stat__value"><CountUp value={outages.length} active={statsVisible} /></span><span className="stat__label">subway elevators out right now</span></div>
            ) : null}
          </div>
        </section>

        <Reveal className="quiet" label="Quiet scores">
          <div className="eq" aria-hidden="true">
            {Array.from({ length: 28 }, (_, index) => <span key={index} style={{ '--i': index } as CSSProperties} />)}
          </div>
          <div className="quiet__copy">
            <p className="kicker kicker--violet">QuietScore</p>
            <h2 className="section-title section-title--light">Too loud is a barrier too.</h2>
            <p>
              Hold up your phone for ten seconds and AccessAll measures how loud a place really is.
              Nothing is recorded. Find the calm library table, the quiet entrance, the room where you can think.
            </p>
          </div>
        </Reveal>

        <section className="finale" aria-labelledby="finale-title">
          <h2 id="finale-title">Every doorway should open<br /><span>for everyone.</span></h2>
          <button type="button" className="btn btn--primary btn--big" onClick={() => onEnter('/auth?mode=signup')}>
            Join AccessAll — it’s free
          </button>
          <button type="button" className="btn btn--link" onClick={() => onEnter('/explore')}>or look around first</button>
        </section>
      </main>

      <footer className="footer">
        <span>AccessAll · made by students in Brooklyn</span>
        <span>Map data © OpenStreetMap contributors · Elevator status from the MTA</span>
      </footer>
    </div>
  );
}
