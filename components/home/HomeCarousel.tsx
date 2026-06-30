"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";

export interface CarouselBannerSlide {
  id: string;
  imageUrl: string;
  linkUrl: string | null;
}

const FALLBACK_SLIDES: CarouselBannerSlide[] = [
  { id: "fallback-1", imageUrl: "/images/home/carousel/portal-carousel-01.png", linkUrl: null },
  { id: "fallback-2", imageUrl: "/images/home/carousel/portal-carousel-02.png", linkUrl: null },
];

const INTERVAL_MS = 10_000;

export function HomeCarousel({ banners }: { banners?: CarouselBannerSlide[] }) {
  const slides = banners && banners.length > 0 ? banners : FALLBACK_SLIDES;
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, INTERVAL_MS);
  }, [slides.length]);

  useEffect(() => {
    setCurrent(0);
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  const goTo = (index: number) => {
    setCurrent(index);
    startTimer();
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-[#0d1425] aspect-[1920/820]">
      {slides.map((slide, i) => {
        const inner = (
          <Image
            src={slide.imageUrl}
            alt={`Slide ${i + 1}`}
            fill
            className="object-contain"
            priority={i === 0}
          />
        );

        return (
          <div
            key={slide.id}
            className="absolute inset-0 transition-opacity duration-700 ease-in-out"
            style={{ opacity: i === current ? 1 : 0 }}
          >
            {slide.linkUrl ? (
              <a
                href={slide.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full h-full"
                tabIndex={i === current ? 0 : -1}
              >
                {inner}
              </a>
            ) : (
              inner
            )}
          </div>
        );
      })}

      {/* Dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Ir para slide ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === current
                  ? "w-6 h-1.5 bg-white"
                  : "w-1.5 h-1.5 bg-white/40 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
