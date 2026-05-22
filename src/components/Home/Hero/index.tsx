"use client";

import HeroCarousel from "./HeroCarousel";
import HeroFeature from "./HeroFeature";
import Image from "next/image";

const Hero = () => {
  return (
    <section className="overflow-hidden pb-10 lg:pb-12.5 xl:pb-15 pt-24 xl:pt-42.5 bg-[#F7EDE7]">
      <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0">
        <div className="relative z-1 rounded-[10px] bg-white overflow-hidden">
          <Image
            src="/images/hero/hero-bg.png"
            alt="hero bg"
            className="absolute right-0 bottom-0 -z-1 pointer-events-none"
            width={534}
            height={520}
          />
          <HeroCarousel />
        </div>
      </div>

      <HeroFeature />
    </section>
  );
};

export default Hero;
