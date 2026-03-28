import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  benchmarkSavings,
  comparisonCards,
  marketingHero,
  pricingPlans
} from "../marketing-content";
import { PricingHeroScene, isWebGlSupported } from "./scene";
import "./shared.css";

gsap.registerPlugin(ScrollTrigger);

function PricingPage() {
  useEffect(() => {
    document.body.classList.add("claritect-marketing");
    const revealTargets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const context = gsap.context(() => {
      revealTargets.forEach((element) => {
        gsap.fromTo(
          element,
          { autoAlpha: 0, y: 28 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.72,
            ease: "power3.out",
            scrollTrigger: {
              trigger: element,
              start: "top 88%"
            }
          }
        );
      });
    });

    return () => {
      context.revert();
      document.body.classList.remove("claritect-marketing");
    };
  }, []);

  const showWebgl = isWebGlSupported();

  return (
    <div className="mk-pricing-root">
      <section className="mk-pricing-hero" data-reveal="pricing-hero">
        <div className="mk-pricing-hero-copy">
          <h1>Consultant-grade insight at a fraction of the cost.</h1>
          <p className="mk-subline">
            Pick a plan. Connect your data. Get your first governed answer the same day — no setup fees, no long-term lock-in.
          </p>
        </div>
        <div className="mk-pricing-hero-art" aria-hidden="true">
          {showWebgl ? <PricingHeroScene /> : null}
        </div>
      </section>

      <section className="mk-pricing-grid">
        {pricingPlans.map((plan) => (
          <article
            className={`mk-card mk-pricing-plan${plan.featured ? " featured" : ""}`}
            key={plan.name}
            data-reveal={plan.name}
          >
            <small>{plan.name}</small>
            <h3>{plan.name}</h3>
            <div className="mk-price-row">
              <strong>{plan.price}</strong>
              <span>{plan.cadence}</span>
            </div>
            <p>{plan.summary}</p>
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <a
              className={`${plan.featured ? "mk-button" : "mk-button-ghost"} mk-plan-cta`}
              href={marketingHero.primaryCta.href}
            >
              {plan.cta}
            </a>
          </article>
        ))}
      </section>

      <section className="mk-compare-section" data-reveal="compare">
        <div className="mk-section-head">
          <h2 className="mk-section-title">How Claritect compares</h2>
        </div>

        <div className="mk-compare-grid">
          {comparisonCards.map((card) => (
            <article
              className={`mk-compare-card${card.featured ? " featured" : ""}`}
              key={card.name}
            >
              <div className="mk-compare-header">
                <h3>{card.name}</h3>
                <div className="mk-compare-cost">
                  <strong>{card.cost}</strong>
                  <span>{card.costNote}</span>
                </div>
                <div className="mk-compare-time">
                  <span className="mk-compare-time-label">Time to answer</span>
                  <span>{card.time}</span>
                </div>
              </div>
              <ul className="mk-compare-traits">
                {card.traits.map((trait) => (
                  <li key={trait.label} className={`mk-trait mk-trait--${trait.status}`}>
                    <span className="mk-trait-icon" aria-hidden="true" />
                    <span>{trait.label}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mk-benchmark-highlight">
          {benchmarkSavings.map((saving) => (
            <div className="mk-highlight-card" key={saving.stat}>
              <strong>{saving.stat} <span className="mk-highlight-detail">{saving.detail}</span></strong>
              <span>{saving.context}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-pricing-closing" data-reveal="pricing-close">
        <div className="mk-content-panel mk-final-cta mk-closing-cta">
          <h2 className="mk-section-title">Try it with your own data.</h2>
          <p className="mk-section-copy">
            Connect your database, ask your first question, and see what Claritect delivers — live, in a single session.
          </p>
          <div className="mk-cta-actions">
            <a className="mk-button" href={marketingHero.primaryCta.href}>
              Book a Live Pilot
            </a>
            <a className="mk-button-ghost" href="/">
              Back to Home
            </a>
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
      <PricingPage />
    </React.StrictMode>
  );
}
