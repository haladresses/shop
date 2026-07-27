"use client";

import HeroCarousel from "./HeroCarousel";
import HeroFeature from "./HeroFeature";

const Hero = () => {
  return (
    <section className="relative overflow-hidden pb-12 lg:pb-16 pt-24 xl:pt-[104px] bg-gradient-to-b from-[#FBF3EF] via-[#F7EDE7] to-white">
      {/* decorative accents */}
      <div aria-hidden className="pointer-events-none absolute -top-16 -left-20 w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-blue/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-24 -right-16 w-56 h-56 sm:w-72 sm:h-72 rounded-full bg-yellow/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 left-1/3 w-52 h-52 rounded-full bg-blue-light-4/30 blur-3xl hidden lg:block" />

      <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0 relative z-10">
        <div className="relative z-1 rounded-2xl sm:rounded-[20px] bg-white overflow-hidden shadow-[0_18px_50px_-20px_rgba(47,36,31,0.25)] ring-1 ring-blue/10">
          <HeroCarousel />
        </div>
      </div>

      <HeroFeature />
    </section>
  );
};

export default Hero;
