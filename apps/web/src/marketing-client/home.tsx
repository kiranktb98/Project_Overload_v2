import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  audienceTiles,
  heroMetrics,
  marketingHero,
  narrativeSlides,
  outcomeBullets,
  shiftLayers,
  solutionStages
} from "../marketing-content";
import { NarrativeScene, isWebGlSupported } from "./scene";
import "./shared.css";

gsap.registerPlugin(ScrollTrigger);

function HomePage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const narrativeRef = useRef<HTMLDivElement>(null);
  const narrativeProgressRef = useRef(0);
  const [activeSlide, setActiveSlide] = useState(0);
  const [webglEnabled, setWebglEnabled] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  /* body class */
  useEffect(() => {
    document.body.classList.add("claritect-marketing");
    return () => {
      document.body.classList.remove("claritect-marketing");
    };
  }, []);

  /* feature detection */
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(reduced.matches);
    update();
    setWebglEnabled(isWebGlSupported());
    reduced.addEventListener("change", update);
    return () => reduced.removeEventListener("change", update);
  }, []);

  /* reveal animations for [data-reveal] elements */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reveals = Array.from(
      root.querySelectorAll<HTMLElement>("[data-reveal]")
    );
    const ctx = gsap.context(() => {
      reveals.forEach((el) => {
        gsap.fromTo(
          el,
          { autoAlpha: 0, y: 36 },
          {
            autoAlpha: 1,
            y: 0,
            duration: reducedMotion ? 0.35 : 0.8,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 86%" }
          }
        );
      });
    }, root);
    return () => ctx.revert();
  }, [reducedMotion]);

  /* narrative scroll progress — drives both text slides & 3D scene */
  useEffect(() => {
    const narr = narrativeRef.current;
    if (!narr) return;
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: narr,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          narrativeProgressRef.current = self.progress;
          setActiveSlide(Math.min(3, Math.floor(self.progress * 3.99)));
        }
      });
    });
    return () => ctx.revert();
  }, []);

  /* static fallback for no-WebGL */
  const staticFallback = useMemo(
    () => (
      <div className="mk-static-hero-art" aria-hidden="true">
        <div className="mk-static-shard s1" />
        <div className="mk-static-shard s2" />
        <div className="mk-static-shard s3" />
        <div className="mk-static-shard s4" />
        <div className="mk-static-shard s5" />
        <div className="mk-static-core" />
        <div className="mk-static-plane p1" />
        <div className="mk-static-plane p2" />
        <div className="mk-static-plane p3" />
      </div>
    ),
    []
  );

  return (
    <div className="mk-home-root" ref={rootRef}>
      {/* ── Hero intro (centered) ── */}
      <section className="mk-section mk-hero-section">
        <div className="mk-section-inner mk-hero-center">
          <div className="mk-hero-panel mk-hero-panel--centered" data-reveal="hero-copy">
            <span className="mk-eyebrow">{marketingHero.eyebrow}</span>
            <h1 className="mk-headline">{marketingHero.headline}</h1>
            <p className="mk-subline">{marketingHero.subline}</p>
            <div className="mk-proof-strip">{marketingHero.proof}</div>
            <div className="mk-hero-actions">
              <a className="mk-button" href={marketingHero.primaryCta.href}>
                {marketingHero.primaryCta.label}
              </a>
              <a className="mk-button-ghost" href={marketingHero.secondaryCta.href}>
                {marketingHero.secondaryCta.label}
              </a>
              <a className="mk-button-link" href={marketingHero.tertiaryCta.href}>
                {marketingHero.tertiaryCta.label}
              </a>
            </div>
            {reducedMotion ? (
              <p className="mk-reduced-note">
                Reduced motion is enabled — the 3D story uses lighter movement.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* ── Scroll-driven narrative (text left + 3D right) ── */}
      <div className="mk-narrative" ref={narrativeRef}>
        <div className="mk-narrative-sticky">
          <div className="mk-section-inner mk-narrative-grid">
            <div className="mk-narrative-text">
              {narrativeSlides.map((slide, i) => (
                <div
                  className={`mk-narrative-slide${activeSlide === i ? " active" : ""}`}
                  key={slide.eyebrow}
                >
                  <span className="mk-eyebrow">{slide.eyebrow}</span>
                  <h2 className="mk-section-title">{slide.title}</h2>
                  <p className="mk-section-copy">{slide.body}</p>
                </div>
              ))}
              <div className="mk-narrative-dots">
                {narrativeSlides.map((_, i) => (
                  <div
                    className={`mk-narrative-dot${activeSlide === i ? " active" : ""}`}
                    key={i}
                  />
                ))}
              </div>
            </div>
            <div className="mk-narrative-canvas">
              {webglEnabled ? (
                <NarrativeScene
                  progressRef={narrativeProgressRef}
                  reducedMotion={reducedMotion}
                />
              ) : (
                staticFallback
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Metrics strip ── */}
      <section className="mk-section mk-metrics-section">
        <div className="mk-section-inner">
          <div className="mk-metrics-strip" data-reveal="metrics">
            {heroMetrics.map((m) => (
              <div className="mk-metric" key={m.label}>
                <strong>{m.value}</strong>
                <span>{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Approach (Problem → Shift → Solution) ── */}
      <section className="mk-section mk-approach-section">
        <div className="mk-section-inner">
          <div className="mk-section-head" data-reveal="approach-head">
            <h2 className="mk-section-title">
              The insight you need. Whenever you need it.
            </h2>
            <p className="mk-section-copy">
              Like having a data analyst and a consulting team on call —
              Claritect turns your questions into governed, actionable answers.
            </p>
          </div>
          <div className="mk-approach-flow" data-reveal="approach-flow">
            <article className="mk-approach-card">
              <div className="mk-phase-num">01</div>
              <h3>The insight gap</h3>
              <p className="mk-approach-lead">
                Great data — turning it into answers takes time and context.
              </p>
              <div className="mk-approach-icon mk-icon-repeat" aria-hidden="true">
                <span /><span /><span />
              </div>
            </article>
            <div className="mk-approach-arrow" aria-hidden="true" />
            <article className="mk-approach-card mk-approach-card--accent">
              <div className="mk-phase-num">02</div>
              <h3>Data to intelligence</h3>
              <p className="mk-approach-lead">
                Not just charts — answers with actions.
              </p>
              <div className="mk-approach-icon mk-icon-ladder" aria-hidden="true">
                {shiftLayers.map((layer) => (
                  <span key={layer.label}>{layer.label}</span>
                ))}
              </div>
            </article>
            <div className="mk-approach-arrow" aria-hidden="true" />
            <article className="mk-approach-card">
              <div className="mk-phase-num">03</div>
              <h3>From questions to action</h3>
              <p className="mk-approach-lead">
                Quick checks, deep dives, or scheduled updates — your call.
              </p>
              <div className="mk-approach-icon mk-icon-steps" aria-hidden="true">
                {solutionStages.map((stage) => (
                  <span key={stage.step}>{stage.title.split(" ")[0]}</span>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ── Audience ── */}
      <section className="mk-section">
        <div className="mk-section-inner">
          <div className="mk-section-head" data-reveal="audience-head">
            <h2 className="mk-section-title">
              Every team has questions. Claritect has answers.
            </h2>
            <p className="mk-section-copy">
              From a quick pipeline check to a full business case —
              ask in plain English and get insight you can act on.
            </p>
          </div>
          <div className="mk-grid-4">
            {audienceTiles.map((tile) => (
              <article
                className="mk-card mk-audience-card"
                key={tile.role}
                data-reveal={tile.role}
              >
                <small>{tile.role}</small>
                <div className="mk-audience-question">{tile.question}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="mk-section">
        <div className="mk-section-inner">
          <div
            className="mk-content-panel mk-final-cta"
            data-reveal="final-cta"
          >
            <h2 className="mk-section-title">
              Your data analyst and consultant — on demand.
            </h2>
            <ul>
              {outcomeBullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <div className="mk-cta-actions">
              <a className="mk-button" href={marketingHero.primaryCta.href}>
                Book a Live Pilot
              </a>
              <a className="mk-button-ghost" href="/pricing">
                See Pricing
              </a>
            </div>
            <div className="mk-trust-line">
              Governed, auditable, and available whenever you need insight.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

const container = document.getElementById("marketing-root");
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <HomePage />
    </React.StrictMode>
  );
}
